import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip, addTrack, setTransition, type Project } from '@editor/core';
import { ffmpegRun, waveformPeaks } from './media';
import { renderProject } from './run';
import { clip, makeFixture, registerMedia, withClips, type Fixture } from './testutil';

let f: Fixture;

async function render(project: Project, name: string) {
  return renderProject(project, { preset: 'ultrafast' }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, name));
}

/** Pico (0..1) do áudio exportado dentro de [from, to] segundos. */
async function peakBetween(file: string, total: number, from: number, to: number): Promise<number> {
  const buckets = 400;
  const w = await waveformPeaks(file, buckets);
  const a = Math.floor((from / total) * buckets);
  const b = Math.max(a + 1, Math.ceil((to / total) * buckets));
  return Math.max(...Array.from(w.slice(a, b)));
}

beforeAll(async () => {
  f = await makeFixture({
    tone440: { color: '202020', duration: 4, tone: 440 },
    tone60: { color: '202020', duration: 4, tone: 60 },
  });
  // Fonte muito baixa (≈ −44 dBFS de pico) para a normalização ter o que corrigir.
  const quiet = path.join(f.dir, 'baixo.mp4');
  await ffmpegRun(['-y', '-f', 'lavfi', '-i', 'color=c=0x202020:s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4,volume=0.05', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', quiet]);
  f.files.quiet = quiet;
  f.project = await registerMedia(f.project, 'quiet', quiet);
}, 120_000);

describe('áudio exportado: resultado medido no arquivo', () => {
  it('mixa duas faixas de áudio: clipes idênticos em faixas diferentes somam o nível', async () => {
    const single = await render(withClips(f, [clip('tone440', 0, 3)]), 'mix-one');
    const p1 = await peakBetween(single.file, 3, 0.5, 2.5);

    let p = withClips(f, [clip('tone440', 0, 3)]);
    const second = addTrack(p, 'video');
    p = addClip(second.project, second.track.id, clip('tone440', 0, 3));
    const both = await render(p, 'mix-two');
    const p2 = await peakBetween(both.file, 3, 0.5, 2.5);

    expect(p1).toBeGreaterThan(0.05);
    expect(p2 / p1).toBeGreaterThan(1.7);
    expect(p2 / p1).toBeLessThan(2.3);
  }, 120_000);

  it('equalizador: reforçar graves em +12 dB eleva um tom de 60 Hz', async () => {
    const flat = await render(withClips(f, [clip('tone60', 0, 3)]), 'eq-flat');
    const c = clip('tone60', 0, 3, { audio: { eq: { bass: 12, mid: 0, treble: 0 } } as never });
    const boosted = await render(withClips(f, [c]), 'eq-bass');
    const a = await peakBetween(flat.file, 3, 0.5, 2.5);
    const b = await peakBetween(boosted.file, 3, 0.5, 2.5);
    expect(b / a).toBeGreaterThan(2.2);

    const cut = clip('tone60', 0, 3, { audio: { eq: { bass: -12, mid: 0, treble: 0 } } as never });
    const quiet = await render(withClips(f, [cut]), 'eq-cut');
    expect((await peakBetween(quiet.file, 3, 0.5, 2.5)) / a).toBeLessThan(0.45);
  }, 180_000);

  it('normalização (2 passadas) leva uma fonte muito baixa a ~-16 LUFS: o pico sobe muito', async () => {
    const off = await render(withClips(f, [clip('quiet', 0, 4)]), 'norm-off');
    const norm = clip('quiet', 0, 4, { audio: { normalize: true } as never });
    const on = await render(withClips(f, [norm]), 'norm-on');
    const a = await peakBetween(off.file, 4, 1, 3.5);
    const b = await peakBetween(on.file, 4, 1, 3.5);
    expect(a).toBeLessThan(0.02);
    expect(b / a, `sem=${a.toFixed(4)} com=${b.toFixed(4)}`).toBeGreaterThan(8);
    expect(b).toBeLessThan(1); // respeita o teto de pico verdadeiro
  }, 120_000);

  it('o volume do usuário é aplicado depois da normalização', async () => {
    const norm = clip('quiet', 0, 4, { audio: { normalize: true } as never });
    const half = clip('quiet', 0, 4, { audio: { normalize: true, volume: 0.5 } as never });
    const a = await peakBetween((await render(withClips(f, [norm]), 'norm-1')).file, 4, 1, 3.5);
    const b = await peakBetween((await render(withClips(f, [half]), 'norm-half')).file, 4, 1, 3.5);
    expect(b / a).toBeGreaterThan(0.4);
    expect(b / a).toBeLessThan(0.6);
  }, 120_000);

  it('redução de ruído não quebra a exportação e preserva o sinal principal', async () => {
    const dn = clip('tone440', 0, 3, { audio: { denoise: true } as never });
    const r = await render(withClips(f, [dn]), 'denoise');
    expect(await peakBetween(r.file, 3, 0.5, 2.5)).toBeGreaterThan(0.03);
  }, 120_000);

  it('crossfade automático: na sobreposição de uma transição o nível não dobra', async () => {
    const solo = await render(withClips(f, [clip('tone440', 0, 4)]), 'xf-solo');
    const ref = await peakBetween(solo.file, 4, 1, 3);

    const a = clip('tone440', 0, 3);
    const b = clip('tone440', 3, 3);
    let p = withClips(f, [a, b]);
    p = setTransition(p, b.id, 'fade', 1); // sobreposição de 1 s em [2, 3]
    const xf = await render(p, 'xf-fade');
    const mid = await peakBetween(xf.file, 5, 2.2, 2.8);
    expect(mid / ref, `ref=${ref.toFixed(3)} meio=${mid.toFixed(3)}`).toBeLessThan(1.45);

    // sem crossfade (sobreposição forçada sem fades) o nível dobraria: confirma que o teste discrimina
    let q = withClips(f, [clip('tone440', 0, 3)]);
    const t2 = addTrack(q, 'video');
    q = addClip(t2.project, t2.track.id, clip('tone440', 2, 3));
    const doubled = await render(q, 'xf-none');
    expect((await peakBetween(doubled.file, 5, 2.2, 2.8)) / ref).toBeGreaterThan(1.7);
  }, 180_000);

  it('balanço: pan totalmente à esquerda reduz o nível total (metade da energia)', async () => {
    const center = await render(withClips(f, [clip('tone440', 0, 3)]), 'pan-c');
    const left = clip('tone440', 0, 3, { audio: { pan: -1 } as never });
    const l = await render(withClips(f, [left]), 'pan-l');
    // O canal esquerdo mantém o nível; o direito some. O pico mono (média) cai pela metade.
    const a = await peakBetween(center.file, 3, 0.5, 2.5);
    const b = await peakBetween(l.file, 3, 0.5, 2.5);
    expect(b / a).toBeGreaterThan(0.4);
    expect(b / a).toBeLessThan(0.6);
  }, 120_000);

  it('fade-in de 2 s: o começo é bem mais baixo que o trecho final', async () => {
    const withFade = clip('tone440', 0, 3, { audio: { fadeIn: 2 } as never });
    const r = await render(withClips(f, [withFade]), 'fadein');
    const early = await peakBetween(r.file, 3, 0, 0.4);
    const late = await peakBetween(r.file, 3, 2.3, 2.9);
    expect(early).toBeLessThan(late * 0.4);
  }, 120_000);
});
