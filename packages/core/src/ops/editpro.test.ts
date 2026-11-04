import { describe, expect, it } from 'vitest';
import { findClip, projectDuration } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { extractAudio } from './advanced';
import * as ops from './editpro';

/** Projeto com um vídeo de 3 s (mídia m1, que tem áudio) a partir de 2 s da timeline, usando m1 desde 1,5 s, e o áudio extraído. */
function withAudio() {
  const { project, trackId } = fixtureProject();
  const v = mediaClip('m1', 2, 3, { sourceIn: 1.5 });
  const p = addClip(project, trackId, v);
  const r = extractAudio(p, v.id);
  return { p: r.project, video: v.id, audio: r.audioId, trackId };
}
const media = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;

describe('jCut', () => {
  it('o áudio passa a começar antes e a imagem fica como estava', () => {
    const s = withAudio();
    const out = ops.jCut(s.p, s.video, 1);
    expect(media(out, s.audio)).toMatchObject({ start: 1, duration: 4, sourceIn: 0.5 });
    expect(media(out, s.video)).toMatchObject({ start: 2, duration: 3, sourceIn: 1.5 });
    expect(media(out, s.audio).linkId).toBe(media(out, s.video).linkId); // continuam ligados
  });

  it('também vale escolhendo o próprio clipe de áudio', () => {
    const s = withAudio();
    expect(media(ops.jCut(s.p, s.audio, 0.5), s.audio).start).toBe(1.5);
  });

  it('recusa sem áudio extraído, sem mídia anterior suficiente e valor fora de 0,05–10', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 2, 3);
    const solo = addClip(project, trackId, c);
    expect(() => ops.jCut(solo, c.id, 1)).toThrow(/Extraia o áudio/);
    const s = withAudio();
    expect(() => ops.jCut(s.p, s.video, 2)).toThrow(); // só há 1,5 s de mídia antes do trecho
    expect(() => ops.jCut(s.p, s.video, 0.01)).toThrow(/0,05/);
  });
});

describe('lCut', () => {
  it('o áudio termina depois da imagem', () => {
    const s = withAudio();
    const out = ops.lCut(s.p, s.video, 1);
    expect(media(out, s.audio)).toMatchObject({ start: 2, duration: 4, sourceIn: 1.5 });
    expect(media(out, s.video).duration).toBe(3);
  });

  it('falha quando a mídia acaba e quando bate no próximo clipe de áudio', () => {
    const s = withAudio();
    expect(() => ops.lCut(s.p, s.video, 6)).toThrow(); // 1,5 + 3 + 6 passa dos 10 s da mídia
    const other = mediaClip('m2', 5.5, 1);
    const t = s.p.tracks.find((x) => x.kind === 'audio')!;
    const blocked = addClip(s.p, t.id, other);
    expect(() => ops.lCut(blocked, s.video, 1)).toThrow();
  });
});

describe('matchVolumeToFirst', () => {
  function three() {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 1, { audio: { ...mediaClip('m1', 0, 1).audio, volume: 0.6 } });
    const b = mediaClip('m1', 1, 1);
    const c = mediaClip('m1', 2, 1, { audio: { ...mediaClip('m1', 0, 1).audio, volume: 2 } });
    const p = [a, b, c].reduce<Project>((acc, x) => addClip(acc, trackId, x), project);
    return { p, a: a.id, b: b.id, c: c.id };
  }

  it('todos passam a ter o volume do primeiro da lista, e a ordem da lista manda', () => {
    const s = three();
    const out = ops.matchVolumeToFirst(s.p, [s.a, s.b, s.c]);
    expect([s.a, s.b, s.c].map((id) => media(out, id).audio.volume)).toEqual([0.6, 0.6, 0.6]);
    const other = ops.matchVolumeToFirst(s.p, [s.c, s.a]);
    expect(media(other, s.a).audio.volume).toBe(2);
    expect(media(other, s.c).audio.volume).toBe(2);
  });

  it('exige pelo menos dois clipes de mídia', () => {
    const s = three();
    expect(() => ops.matchVolumeToFirst(s.p, [s.a])).toThrow(/dois clipes/);
  });
});

describe('holdLastFrame', () => {
  it('cria o quadro parado logo depois, do último instante da mídia, e empurra o clipe seguinte', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4, { sourceIn: 1 });
    const b = mediaClip('m1', 4, 2);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    const r = ops.holdLastFrame(p, a.id, 2);
    const hold = media(r.project, r.freezeId);
    expect(hold).toMatchObject({ start: 4, duration: 2, freeze: true, speed: 1, reverse: false });
    expect(hold.sourceIn).toBeCloseTo(1 + 4 - 1 / 30, 5);
    expect(hold.audio.muted).toBe(true);
    expect(media(r.project, b.id).start).toBe(6);
    expect(projectDuration(r.project)).toBe(8);
  });

  it('em clipe invertido o último quadro visível é o início da mídia usada', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2, { sourceIn: 3, reverse: true });
    const r = ops.holdLastFrame(addClip(project, trackId, a), a.id, 1);
    expect(media(r.project, r.freezeId).sourceIn).toBe(3);
  });

  it('recusa quadro já parado, imagem, tempo fora de 0,1–30 e texto', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2, { freeze: true });
    const p = addClip(project, trackId, a);
    expect(() => ops.holdLastFrame(p, a.id)).toThrow(/já é um quadro parado/);
    const b = mediaClip('m2', 5, 2);
    const q = addClip(project, trackId, b);
    expect(() => ops.holdLastFrame(q, b.id, 0.05)).toThrow(/0,1/);
    expect(() => ops.holdLastFrame(q, b.id, 31)).toThrow();
    const img = { ...q, media: { ...q.media, m2: { ...q.media.m2!, kind: 'image' as const } } };
    expect(() => ops.holdLastFrame(img, b.id)).toThrow(/vídeo/);
  });
});
