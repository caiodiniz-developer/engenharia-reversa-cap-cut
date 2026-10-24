import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addLut, applyEffectsToPixels, createEffect, identityLut, resolveLut, serializeCube, updateClip, type Project } from '@editor/core';
import { ffmpegRun } from './media';
import { probeMedia } from './probe';
import { renderProject } from './run';
import { clip, makeFixture, near, pixelAt, registerMedia, withClips, type Fixture } from './testutil';

let f: Fixture;

async function render(project: Project, name: string, opts: Parameters<typeof renderProject>[1] = {}) {
  return renderProject(project, { preset: 'ultrafast', ...opts }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, name));
}

/** Média da diferença absoluta entre quadros consecutivos (luma): menor = imagem mais estável. */
async function jitter(file: string): Promise<number> {
  const { stderr } = await ffmpegRun(['-i', file, '-an', '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-']);
  const v = [...stderr.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  // ignora o primeiro quadro (sem anterior) e descarta as bordas por causa da pré-estabilização
  const mid = v.slice(5, -5);
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

beforeAll(async () => {
  f = await makeFixture({ tint: { color: 'c86432', duration: 3 }, red: { color: 'ff0000', duration: 3 } });
  // Câmera "tremendo": recorte que balança em duas frequências sobre um padrão de teste.
  const shaky = path.join(f.dir, 'tremido.mp4');
  await ffmpegRun([
    '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=4',
    '-vf', "crop=560:300:x='40+14*sin(2*PI*3*t)+8*sin(2*PI*7.3*t)':y='30+10*cos(2*PI*2.1*t)+6*sin(2*PI*6.1*t)'",
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', shaky,
  ]);
  f.files.shaky = shaky;
  f.project = await registerMedia(f.project, 'shaky', shaky);
}, 120_000);

describe('LUTs na exportação', () => {
  it('LUT importada (.cube) troca R↔B: o vermelho vira azul no arquivo exportado', async () => {
    const id2 = identityLut(2);
    const swap = new Float32Array(id2.data.length);
    for (let i = 0; i < swap.length; i += 3) {
      swap[i] = id2.data[i + 2]!;
      swap[i + 1] = id2.data[i + 1]!;
      swap[i + 2] = id2.data[i]!;
    }
    let p = withClips(f, [clip('red', 0, 1.5)]);
    const imported = addLut(p, 'Troca R-B', serializeCube({ title: 'swap', size: 2, data: swap }));
    p = imported.project;
    const c = p.tracks[0]!.clips[0]!;
    p = updateClip(p, c.id, (x) => (x.type === 'media' ? { ...x, effects: [createEffect('lut', { intensity: 1 }, imported.id)] } : x));
    const { file } = await render(p, 'lut-swap');
    expect(near(await pixelAt(file, 0.75, 160, 90), [0, 0, 255], 40)).toBe(true);
  }, 120_000);

  it('LUT embutida: o arquivo exportado coincide com a prévia (mesma matemática, trilinear)', async () => {
    for (const [ref, intensity] of [['builtin:teal-orange', 1], ['builtin:noir', 0.6], ['builtin:warm-film', 1]] as const) {
      const fx = createEffect('lut', { intensity }, ref);
      const c = clip('tint', 0, 1.5, { effects: [fx] });
      const p = withClips(f, [c]);
      const { file } = await render(p, `lut-${ref.slice(8)}`);
      const px = new Uint8ClampedArray([200, 100, 50, 255]);
      applyEffectsToPixels(px, 1, 1, [fx], (r) => resolveLut(p.luts, r));
      const out = await pixelAt(file, 0.75, 160, 90);
      expect(near(out, [px[0]!, px[1]!, px[2]!], 14), `${ref}: preview ${[...px.slice(0, 3)]} vs export ${out}`).toBe(true);
      const moved = Math.abs(out[0] - 200) + Math.abs(out[1] - 100) + Math.abs(out[2] - 50);
      expect(moved, `${ref} deveria alterar a cor (saída ${out})`).toBeGreaterThan(8);
    }
  }, 180_000);

  it('referência de LUT inexistente falha com mensagem clara (sem exportar errado em silêncio)', async () => {
    const c = clip('tint', 0, 1, { effects: [createEffect('lut', {}, 'lut_que_nao_existe')] });
    await expect(render(withClips(f, [c]), 'lut-missing')).rejects.toThrow(/LUT .* não encontrada/);
  });
});

describe('estabilização de imagem', () => {
  it('reduz a tremedeira entre quadros e mantém a duração e a resolução', async () => {
    const c = clip('shaky', 0, 3.5);
    const off = await render(withClips(f, [c]), 'stab-off', { width: 560, height: 300 });
    const c2 = clip('shaky', 0, 3.5, { stabilize: 20 });
    const on = await render(withClips(f, [c2]), 'stab-on', { width: 560, height: 300 });

    const info = await probeMedia(on.file);
    expect([info.width, info.height]).toEqual([560, 300]);
    expect(info.duration).toBeGreaterThan(3.3);
    expect(info.duration).toBeLessThan(3.7);

    const a = await jitter(off.file);
    const b = await jitter(on.file);
    console.log(`instabilidade média entre quadros: sem estabilização=${a.toFixed(2)} com estabilização=${b.toFixed(2)}`);
    expect(b, `instabilidade: sem=${a.toFixed(2)} com=${b.toFixed(2)}`).toBeLessThan(a * 0.8);
  }, 180_000);

  it('combina com velocidade 2× e recorte de origem', async () => {
    const c = clip('shaky', 0, 1.5, { stabilize: 10, speed: 2, sourceIn: 0.5 });
    const { file } = await render(withClips(f, [c]), 'stab-speed');
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(1.3);
    expect(info.duration).toBeLessThan(1.7);
  }, 120_000);
});
