import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import * as ops from './creative';

/** Projeto com uma faixa de vídeo e clipes de m1 (10 s) nos intervalos dados. */
function build(...spans: Array<[number, number]>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, trackId, ids };
}
const media = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;
const sorted = (p: Project) => [...p.tracks[0]!.clips].sort((a, b) => a.start - b.start) as MediaClip[];

describe('speedRamp', () => {
  it('cobre toda a mídia, com velocidades crescentes e trechos encostados', () => {
    const { p, ids } = build([0, 4], [4, 6]);
    const r = ops.speedRamp(p, ids[0]!, { from: 0.5, to: 2, parts: 4 });
    const parts = r.ids.map((id) => media(r.project, id));
    expect(parts.map((c) => c.sourceIn)).toEqual([0, 1, 2, 3]);
    const speeds = parts.map((c) => c.speed);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(speeds[0]).toBeCloseTo(0.6875, 6);
    expect(speeds[3]).toBeCloseTo(1.8125, 6);
    expect(parts.reduce((n, c) => n + c.duration * c.speed, 0)).toBeCloseTo(4, 5); // toda a mídia usada
    for (let i = 1; i < parts.length; i++) expect(parts[i]!.start).toBeCloseTo(parts[i - 1]!.start + parts[i - 1]!.duration, 5);
  });

  it('o resto da faixa anda a diferença de duração', () => {
    const { p, ids } = build([0, 4], [4, 6]);
    const r = ops.speedRamp(p, ids[0]!, { from: 0.5, to: 2, parts: 4 });
    const total = r.ids.reduce((n, id) => n + media(r.project, id).duration, 0);
    expect(media(r.project, ids[1]!).start).toBeCloseTo(total, 5);
    const fast = ops.speedRamp(p, ids[0]!, { from: 4, to: 8, parts: 3 }); // fica mais curto
    expect(media(fast.project, ids[1]!).start).toBeLessThan(4);
  });

  it('a curva suave desacelera as pontas em relação à linear', () => {
    const { p, ids } = build([0, 4]);
    const lin = ops.speedRamp(p, ids[0]!, { from: 1, to: 4, parts: 6 });
    const smooth = ops.speedRamp(p, ids[0]!, { from: 1, to: 4, parts: 6, smooth: true });
    expect(media(smooth.project, smooth.ids[0]!).speed).toBeLessThan(media(lin.project, lin.ids[0]!).speed);
    expect(media(smooth.project, smooth.ids[5]!).speed).toBeGreaterThan(media(lin.project, lin.ids[5]!).speed);
  });

  it('recusa velocidade fora de 0,1–16, partes inválidas, clipe invertido, ligado ou com keyframes', () => {
    const { p, ids } = build([0, 4]);
    expect(() => ops.speedRamp(p, ids[0]!, { from: 0.05, to: 2 })).toThrow(/0,1/);
    expect(() => ops.speedRamp(p, ids[0]!, { from: 1, to: 2, parts: 2 })).toThrow(/3 a 12/);
    const rev = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, reverse: true })) })) } as Project;
    expect(() => ops.speedRamp(rev, ids[0]!, { from: 1, to: 2 })).toThrow(/invertido/);
    const linked = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, linkId: 'x' })) })) } as Project;
    expect(() => ops.speedRamp(linked, ids[0]!, { from: 1, to: 2 })).toThrow(/Desvincule/);
    const kf = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, keyframes: { scale: [{ time: 0, value: 1, easing: 'linear' as const }] } })) })) } as Project;
    expect(() => ops.speedRamp(kf, ids[0]!, { from: 1, to: 2 })).toThrow(/keyframes/);
  });
});

describe('boomerang', () => {
  it('a cópia começa no fim do original, toca o mesmo trecho em reverso', () => {
    const { p, ids } = build([1, 3]);
    const r = ops.boomerang(p, ids[0]!);
    const copy = media(r.project, r.newId);
    expect(copy).toMatchObject({ start: 3, duration: 2, sourceIn: 0, reverse: true });
    expect(media(r.project, ids[0]!).reverse).toBe(false);
  });

  it('se o original já era reverso, a volta é no sentido normal; congelado é recusado', () => {
    const { p, ids } = build([0, 2]);
    const rev = ops.boomerang(p, ids[0]!);
    const again = ops.boomerang(rev.project, rev.newId);
    expect(media(again.project, again.newId).reverse).toBe(false);
    const frozen = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, freeze: true })) })) } as Project;
    expect(() => ops.boomerang(frozen, ids[0]!)).toThrow(/congelado/);
  });

  it('falha se a cópia bater no clipe seguinte', () => {
    const { p, ids } = build([0, 2], [2, 4]);
    expect(() => ops.boomerang(p, ids[0]!)).toThrow();
  });
});

describe('stutter', () => {
  it('repete o trecho do meio e empurra o clipe seguinte', () => {
    const { p, ids } = build([0, 4], [4, 6]);
    const r = ops.stutter(p, ids[0]!, 1, 0.5, 3);
    const clips = sorted(r.project);
    // 0–1, depois 4 cópias do trecho 1–1,5 (original + 3), depois 1,5–4 e o clipe seguinte
    expect(r.ids).toHaveLength(4);
    for (const id of r.ids) expect(media(r.project, id)).toMatchObject({ duration: 0.5, sourceIn: 1 });
    expect(clips.map((c) => [c.start, c.duration])).toEqual([[0, 1], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 2.5], [5.5, 2]]);
  });

  it('funciona no início e no fim do clipe', () => {
    const { p, ids } = build([0, 2]);
    const start = ops.stutter(p, ids[0]!, 0, 0.25, 2);
    expect(sorted(start.project).map((c) => c.duration)).toEqual([0.25, 0.25, 0.25, 1.75]);
    const endCut = ops.stutter(p, ids[0]!, 1.5, 0.5, 1);
    expect(sorted(endCut.project).map((c) => [c.start, c.duration])).toEqual([[0, 1.5], [1.5, 0.5], [2, 0.5]]);
  });

  it('recusa trecho fora do clipe, tamanho ou repetições inválidos e clipe ligado', () => {
    const { p, ids } = build([0, 2]);
    expect(() => ops.stutter(p, ids[0]!, 1.8, 0.5, 2)).toThrow(/dentro do clipe/);
    expect(() => ops.stutter(p, ids[0]!, 0.5, 0.01, 2)).toThrow(/0,05/);
    expect(() => ops.stutter(p, ids[0]!, 0.5, 0.5, 0)).toThrow(/1 a 16/);
    const linked = { ...p, tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, linkId: 'x' })) })) } as Project;
    expect(() => ops.stutter(linked, ids[0]!, 0.5, 0.5, 2)).toThrow(/Desvincule/);
  });
});

describe('smoothCuts', () => {
  it('aplica fade de saída e entrada só nos cortes encostados', () => {
    const { p, trackId, ids } = build([0, 2], [2, 4], [6, 8]); // o terceiro tem vão antes
    const r = ops.smoothCuts(p, trackId, 0.1);
    expect(r.cuts).toBe(1);
    expect(media(r.project, ids[0]!).audio.fadeOut).toBe(0.1);
    expect(media(r.project, ids[1]!).audio.fadeIn).toBe(0.1);
    expect(media(r.project, ids[1]!).audio.fadeOut).toBe(0);
    expect(media(r.project, ids[2]!).audio.fadeIn).toBe(0);
  });

  it('o fade nunca passa da metade do clipe e valores fora de 0,01–1 falham', () => {
    const { p, trackId, ids } = build([0, 0.2], [0.2, 2]);
    const r = ops.smoothCuts(p, trackId, 0.5);
    expect(media(r.project, ids[0]!).audio.fadeOut).toBe(0.1);
    expect(() => ops.smoothCuts(p, trackId, 0)).toThrow();
    expect(() => ops.smoothCuts(p, trackId, 2)).toThrow();
  });

  it('sem cortes encostados não muda nada', () => {
    const { p, trackId } = build([0, 1], [3, 4]);
    expect(ops.smoothCuts(p, trackId)).toEqual({ project: p, cuts: 0 });
  });
});

describe('pictureInPicture', () => {
  it('vai para cada canto com a escala escolhida e margem de 3%', () => {
    const { p, ids } = build([0, 2]);
    const tr = (corner: 'tl' | 'tr' | 'bl' | 'br') => media(ops.pictureInPicture(p, ids[0]!, corner, 0.3), ids[0]!).transform;
    expect(tr('br')).toMatchObject({ scale: 0.3, x: 0.32, y: 0.32 }); // 0,5 − 0,15 − 0,03
    expect(tr('tl')).toMatchObject({ x: -0.32, y: -0.32 });
    expect(tr('tr')).toMatchObject({ x: 0.32, y: -0.32 });
    expect(tr('bl')).toMatchObject({ x: -0.32, y: 0.32 });
  });

  it('mídia vertical num quadro horizontal ocupa menos largura e fica mais perto da borda', () => {
    const { p, ids } = build([0, 2]);
    const vertical: Project = { ...p, media: { ...p.media, m1: { ...p.media.m1!, width: 1080, height: 1920 } } };
    const wide = media(ops.pictureInPicture(p, ids[0]!, 'br', 0.4), ids[0]!).transform.x;
    const tall = media(ops.pictureInPicture(vertical, ids[0]!, 'br', 0.4), ids[0]!).transform.x;
    expect(tall).toBeGreaterThan(wide); // largura exibida menor → centro mais perto do canto
  });

  it('recusa tamanhos fora de 10–60%', () => {
    const { p, ids } = build([0, 2]);
    expect(() => ops.pictureInPicture(p, ids[0]!, 'br', 0.05)).toThrow(/10%/);
    expect(() => ops.pictureInPicture(p, ids[0]!, 'br', 0.9)).toThrow();
  });
});
