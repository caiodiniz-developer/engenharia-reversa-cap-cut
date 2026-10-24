import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addClip,
  addTrack,
  applyEffectsToPixels,
  createEffect,
  setReverse,
  setTrackProps,
  setTransition,
  freezeFrame,
  upsertKeyframe,
  TextClipSchema,
  CaptionClipSchema,
  newId,
  type Project,
} from '@editor/core';
import { detectSilenceFfmpeg, waveformPeaks } from './media';
import { probeMedia } from './probe';
import { RenderCancelled, renderProject } from './run';
import { clip, countPixels, frameData, makeFixture, near, pixelAt, registerMedia, withClips, type Fixture } from './testutil';

let f: Fixture;
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const BLACK = [0, 0, 0];

async function render(project: Project, name: string, opts: Parameters<typeof renderProject>[1] = {}, signal?: AbortSignal) {
  const env = { resolveMedia: (id: string) => f.files[id]!, tmpRoot: f.dir };
  return renderProject(project, { preset: 'ultrafast', ...opts }, env, path.join(f.dir, name), { signal });
}

beforeAll(async () => {
  f = await makeFixture({
    red: { color: 'ff0000', duration: 4, tone: 440 },
    green: { color: '00ff00', duration: 4, tone: 880 },
    blue: { color: '0000ff', duration: 4 },
    tint: { color: 'c86432', duration: 2 },
  });
}, 120_000);

describe('transformações', () => {
  it('escala e posição', async () => {
    const c = clip('red', 0, 2, { transform: { scale: 0.5, x: 0.25 } as never });
    const { file } = await render(withClips(f, [c]), 'tf1');
    expect(near(await pixelAt(file, 1, 200, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 1, 100, 90), BLACK)).toBe(true);
    expect(near(await pixelAt(file, 1, 10, 10), BLACK)).toBe(true);
  }, 120_000);

  it('opacidade estática', async () => {
    const c = clip('red', 0, 2, { transform: { opacity: 0.5 } as never });
    const { file } = await render(withClips(f, [c]), 'tf2');
    const px = await pixelAt(file, 1, 160, 90);
    expect(near(px, [128, 0, 0], 20)).toBe(true);
  }, 120_000);

  it('rotação de 90° troca as extensões horizontal e vertical', async () => {
    const c = clip('red', 0, 2, { transform: { scale: 0.5, rotation: 90 } as never });
    const { file } = await render(withClips(f, [c]), 'tf3');
    expect(near(await pixelAt(file, 1, 160, 20), RED)).toBe(true);
    expect(near(await pixelAt(file, 1, 100, 90), BLACK)).toBe(true);
  }, 120_000);

  it('keyframes animam a posição ao longo do tempo', async () => {
    let kx = upsertKeyframe(undefined, 0, -0.4);
    kx = upsertKeyframe(kx, 2, 0.4);
    const c = clip('red', 0, 2, { transform: { scale: 0.2 } as never, keyframes: { x: kx } });
    const { file } = await render(withClips(f, [c]), 'tf4');
    expect(near(await pixelAt(file, 0.1, 40, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 0.1, 280, 90), BLACK)).toBe(true);
    expect(near(await pixelAt(file, 1.9, 280, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 1.9, 40, 90), BLACK)).toBe(true);
  }, 120_000);

  it('keyframes de escala (zoom) usando a variável de tempo do scale', async () => {
    let ks = upsertKeyframe(undefined, 0, 0.2);
    ks = upsertKeyframe(ks, 2, 1);
    const c = clip('red', 0, 2, { keyframes: { scale: ks } });
    const { file } = await render(withClips(f, [c]), 'tf5');
    expect(near(await pixelAt(file, 0.1, 30, 90), BLACK)).toBe(true);
    expect(near(await pixelAt(file, 1.9, 30, 90), RED)).toBe(true);
  }, 120_000);

  it('máscara elíptica recorta o clipe', async () => {
    const c = clip('red', 0, 2, { mask: { shape: 'ellipse', cx: 0.5, cy: 0.5, w: 0.5, h: 0.5, invert: false } });
    const { file } = await render(withClips(f, [c]), 'mask');
    expect(near(await pixelAt(file, 1, 160, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 1, 20, 20), BLACK)).toBe(true);
  }, 120_000);

  it('recorte (crop) mostra apenas parte do clipe', async () => {
    const c = clip('red', 0, 2, { transform: { crop: { l: 0.5, t: 0, r: 0, b: 0 } } as never });
    const { file } = await render(withClips(f, [c]), 'crop');
    expect(near(await pixelAt(file, 1, 160, 90), RED)).toBe(true);
  }, 120_000);
});

describe('efeitos', () => {
  it('saturação + brilho: exportação coincide com o preview em pixels', async () => {
    const fx = [createEffect('saturation', { amount: 0.5 }), createEffect('brightness', { amount: 0.1 })];
    const c = clip('tint', 0, 1.5, { effects: fx });
    const { file } = await render(withClips(f, [c]), 'fx1');
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    applyEffectsToPixels(px, 1, 1, fx);
    const out = await pixelAt(file, 0.75, 160, 90);
    expect(near(out, [px[0]!, px[1]!, px[2]!], 14)).toBe(true);
    // e difere do original
    expect(near(out, [200, 100, 50], 14)).toBe(false);
  }, 120_000);

  it('contraste e exposição coincidem com o preview', async () => {
    const fx = [createEffect('contrast', { amount: 1.5 }), createEffect('exposure', { stops: 0.5 })];
    const c = clip('tint', 0, 1.5, { effects: fx });
    const { file } = await render(withClips(f, [c]), 'fx2');
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    applyEffectsToPixels(px, 1, 1, fx);
    expect(near(await pixelAt(file, 0.75, 160, 90), [px[0]!, px[1]!, px[2]!], 14)).toBe(true);
  }, 120_000);

  it('desfoque, vinheta, nitidez, grão, glitch e aberração renderizam sem erro', async () => {
    const fx = [
      createEffect('blur', { sigma: 4 }),
      createEffect('sharpen', { amount: 1 }),
      createEffect('vignette', { amount: 0.8 }),
      createEffect('grain', { amount: 0.2 }),
      createEffect('glitch', { amount: 0.3 }),
      createEffect('aberration', { px: 4 }),
      createEffect('temperature', { amount: 0.5 }),
    ];
    const c = clip('tint', 0, 1, { effects: fx });
    const { file } = await render(withClips(f, [c]), 'fx3');
    expect((await probeMedia(file)).duration).toBeGreaterThan(0.9);
    // vinheta escurece o canto em relação ao centro
    const corner = await pixelAt(file, 0.5, 2, 2);
    const center = await pixelAt(file, 0.5, 160, 90);
    expect(corner[0] + corner[1] + corner[2]).toBeLessThan(center[0] + center[1] + center[2]);
  }, 120_000);

  it('chroma key remove o verde e revela a camada de baixo', async () => {
    let p = withClips(f, [clip('green', 0, 2, { effects: [createEffect('chromakey', { similarity: 0.3, blend: 0.05 })] })]);
    const lower = addTrack(p, 'video', { index: p.tracks.length });
    p = addClip(lower.project, lower.track.id, clip('red', 0, 2));
    const { file } = await render(p, 'chroma');
    expect(near(await pixelAt(file, 1, 160, 90), RED)).toBe(true);
  }, 120_000);
});

describe('transições', () => {
  const setup = async (type: Parameters<typeof setTransition>[2], name: string) => {
    const a = clip('red', 0, 3);
    const b = clip('blue', 3, 3);
    const p = setTransition(withClips(f, [a, b]), b.id, type, 1);
    return render(p, name);
  };

  it('slide-left: o clipe novo entra pela direita', async () => {
    const { file } = await setup('slide-left', 'tr-slide');
    expect(near(await pixelAt(file, 2.5, 50, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 2.5, 270, 90), BLUE)).toBe(true);
  }, 120_000);

  it('wipe-right revela o clipe novo da esquerda para a direita', async () => {
    const { file } = await setup('wipe-right', 'tr-wipe');
    expect(near(await pixelAt(file, 2.5, 50, 90), BLUE)).toBe(true);
    expect(near(await pixelAt(file, 2.5, 270, 90), RED)).toBe(true);
  }, 120_000);
});

describe('texto e legendas', () => {
  it('título aparece no quadro apenas durante sua duração', async () => {
    let p = withClips(f, [clip('blue', 0, 3)]);
    const t = addTrack(p, 'text');
    const text = TextClipSchema.parse({
      id: newId('clp'),
      type: 'text',
      text: 'OLÁ MUNDO',
      start: 1,
      duration: 1,
      style: { fontSize: 90, color: '#ffffff', fontFamily: 'Arial', bold: true },
    });
    p = addClip(t.project, t.track.id, text);
    const { file } = await render(p, 'text');
    const white = (r: number, g: number, b: number) => r > 200 && g > 200 && b > 200;
    expect(countPixels(await frameData(file, 1.5), white)).toBeGreaterThan(300);
    expect(countPixels(await frameData(file, 0.5), white)).toBe(0);
    expect(countPixels(await frameData(file, 2.5), white)).toBe(0);
  }, 120_000);

  it('legenda destaca a palavra falada', async () => {
    let p = withClips(f, [clip('blue', 0, 3)]);
    const t = addTrack(p, 'caption');
    const cap = CaptionClipSchema.parse({
      id: newId('clp'),
      type: 'caption',
      text: 'um dois três',
      start: 0.5,
      duration: 2,
      words: [
        { text: 'um', start: 0, end: 0.6 },
        { text: 'dois', start: 0.7, end: 1.3 },
        { text: 'três', start: 1.4, end: 2 },
      ],
      highlightColor: '#ffff00',
      style: { fontSize: 300, color: '#ffffff', fontFamily: 'Arial', bold: true, strokeWidth: 0 },
      transform: { y: 0 },
    });
    p = addClip(t.project, t.track.id, cap);
    const { file } = await render(p, 'caption');
    const yellow = (r: number, g: number, b: number) => r > 200 && g > 200 && b < 80;
    const white = (r: number, g: number, b: number) => r > 200 && g > 200 && b > 200;
    const during = await frameData(file, 1.0); // palavra "dois"
    expect(countPixels(during, yellow)).toBeGreaterThan(150);
    expect(countPixels(during, white)).toBeGreaterThan(150); // demais palavras
    expect(countPixels(await frameData(file, 0.2), yellow)).toBe(0); // antes da legenda
  }, 120_000);

  it('animação fade-in do texto: quadro inicial é mais transparente', async () => {
    let p = withClips(f, [clip('blue', 0, 3)]);
    const t = addTrack(p, 'text');
    const text = TextClipSchema.parse({
      id: newId('clp'),
      type: 'text',
      text: 'FADE',
      start: 0,
      duration: 2,
      style: { fontSize: 120, color: '#ffffff' },
      animationIn: { type: 'fade', duration: 1 },
    });
    p = addClip(t.project, t.track.id, text);
    const { file } = await render(p, 'textfade');
    const white = (r: number, g: number, b: number) => r > 200 && g > 200 && b > 200;
    const early = countPixels(await frameData(file, 0.1), white);
    const late = countPixels(await frameData(file, 1.5), white);
    expect(late).toBeGreaterThan(early);
  }, 120_000);
});

describe('áudio', () => {
  it('mixa faixas e volume 0 silencia', async () => {
    const audible = await render(withClips(f, [clip('red', 0, 2)]), 'au1');
    expect((await waveformPeaks(audible.file, 50)).some((v) => v > 0.1)).toBe(true);

    const muted = clip('red', 0, 2, { audio: { volume: 0 } as never });
    const silent = await render(withClips(f, [muted]), 'au2');
    const sil = await detectSilenceFfmpeg(silent.file, { noiseDb: -50, minDuration: 1 });
    expect(sil.length).toBe(1);
    expect(sil[0]!.end - sil[0]!.start).toBeGreaterThan(1.5);
  }, 120_000);

  it('faixa silenciada (mute) remove o áudio; faixa oculta remove o vídeo', async () => {
    const p = withClips(f, [clip('red', 0, 2)]);
    const track = p.tracks[0]!.id;
    const muted = await render(setTrackProps(p, track, { muted: true }), 'au3');
    expect((await waveformPeaks(muted.file, 20)).every((v) => v < 0.01)).toBe(true);
    const hidden = await render(setTrackProps(p, track, { hidden: true }), 'au4');
    expect(near(await pixelAt(hidden.file, 1, 160, 90), BLACK)).toBe(true);
    expect((await waveformPeaks(hidden.file, 20)).some((v) => v > 0.1)).toBe(true);
  }, 120_000);

  it('fade-out reduz o volume ao final', async () => {
    const c = clip('red', 0, 3, { audio: { fadeOut: 2 } as never });
    const { file } = await render(withClips(f, [c]), 'au5');
    const w = await waveformPeaks(file, 30);
    const head = Math.max(...Array.from(w.slice(0, 5)));
    const tail = Math.max(...Array.from(w.slice(26, 30)));
    expect(tail).toBeLessThan(head * 0.4);
  }, 120_000);
});

describe('reverso, congelar quadro e origem', () => {
  let rb: Project;
  beforeAll(async () => {
    // Fonte "vermelho 2s + azul 2s" renderizada pelo próprio motor.
    const base = withClips(f, [clip('red', 0, 2), clip('blue', 2, 2)]);
    const { file } = await render(base, 'redblue');
    f.files.rb = file;
    rb = await registerMedia(f.project, 'rb', file);
  }, 120_000);

  const track = () => {
    const r = addTrack(rb, 'video');
    return r;
  };

  it('sourceIn escolhe o trecho da mídia', async () => {
    const t = track();
    const p = addClip(t.project, t.track.id, clip('rb', 0, 1, { sourceIn: 2.5 }));
    const { file } = await render(p, 'src');
    expect(near(await pixelAt(file, 0.5, 160, 90), BLUE)).toBe(true);
  }, 120_000);

  it('reproduz em reverso', async () => {
    const t = track();
    const c = clip('rb', 0, 4);
    let p = addClip(t.project, t.track.id, c);
    p = setReverse(p, c.id, true);
    const { file } = await render(p, 'rev');
    expect(near(await pixelAt(file, 0.5, 160, 90), BLUE)).toBe(true);
    expect(near(await pixelAt(file, 3.5, 160, 90), RED)).toBe(true);
  }, 120_000);

  it('congelar quadro prolonga o último quadro do ponto escolhido', async () => {
    const t = track();
    const c = clip('rb', 0, 4);
    let p = addClip(t.project, t.track.id, c);
    p = freezeFrame(p, c.id, 1, 3).project; // congela vermelho em t=1 por 3s
    const { file } = await render(p, 'freeze');
    expect((await probeMedia(file)).duration).toBeGreaterThan(6.9);
    expect(near(await pixelAt(file, 3.5, 160, 90), RED)).toBe(true); // ainda vermelho (congelado)
    expect(near(await pixelAt(file, 6.5, 160, 90), BLUE)).toBe(true);
  }, 120_000);
});

describe('formatos e controle', () => {
  it('exporta VP9/WebM e H.265', async () => {
    const p = withClips(f, [clip('red', 0, 1)]);
    const vp9 = await render(p, 'o-vp9', { codec: 'vp9' });
    expect(vp9.file.endsWith('.webm')).toBe(true);
    expect((await probeMedia(vp9.file)).videoCodec).toBe('vp9');
    const h265 = await render(p, 'o-h265', { codec: 'h265' });
    expect((await probeMedia(h265.file)).videoCodec).toBe('hevc');
  }, 180_000);

  it('substitui resolução e fps; força dimensões pares', async () => {
    const p = withClips(f, [clip('red', 0, 1)]);
    const { file } = await render(p, 'o-res', { width: 201, height: 101, fps: 24 });
    const info = await probeMedia(file);
    expect([info.width, info.height]).toEqual([202, 102]);
    expect(info.fps).toBeCloseTo(24, 1);
  }, 120_000);

  it('exporta apenas um intervalo', async () => {
    const p = withClips(f, [clip('red', 0, 2), clip('green', 2, 2)]);
    const { file } = await render(p, 'o-range', { range: { start: 1.5, end: 3 } });
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(1.4);
    expect(info.duration).toBeLessThan(1.6);
    expect(near(await pixelAt(file, 0.2, 160, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 1.3, 160, 90), GREEN)).toBe(true);
  }, 120_000);

  it('projeto vazio é recusado', async () => {
    await expect(render(f.project, 'o-empty')).rejects.toThrow(/vazio/);
  });

  it('cancelamento interrompe o FFmpeg e limpa temporários', async () => {
    const p = withClips(f, [clip('red', 0, 4)]);
    const ctrl = new AbortController();
    const running = render(p, 'o-cancel', { preset: 'slow', width: 1280, height: 720 }, ctrl.signal);
    setTimeout(() => ctrl.abort(), 150);
    await expect(running).rejects.toBeInstanceOf(RenderCancelled);
    const leftovers = (await readdir(f.dir)).filter((n) => n.startsWith('render-'));
    expect(leftovers).toEqual([]);
  }, 120_000);

  it('reporta progresso crescente até 1', async () => {
    const p = withClips(f, [clip('red', 0, 3)]);
    const seen: number[] = [];
    const env = { resolveMedia: (id: string) => f.files[id]!, tmpRoot: f.dir };
    await renderProject(p, { preset: 'ultrafast' }, env, path.join(f.dir, 'o-prog'), { onProgress: (x) => seen.push(x) });
    expect(seen.at(-1)).toBe(1);
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1]!)).toBe(true);
  }, 120_000);

  void GREEN;
});
