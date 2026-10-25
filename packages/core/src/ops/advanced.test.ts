import { describe, expect, it } from 'vitest';
import { findClip, projectDuration } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { closeGaps, extractAudio, freezeFrame, removeRanges, removeTransition, setSpeed, setTransition } from './advanced';
import { updateClip } from './clips';
import { setTrackProps } from './tracks';
import type { Project } from '../schema';

describe('setSpeed', () => {
  it('2x reduz a duração pela metade e mantém o trecho de origem', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4);
    const p = setSpeed(addClip(project, trackId, c), c.id, 2);
    expect(findClip(p, c.id)!.clip).toMatchObject({ duration: 2, speed: 2, sourceIn: 0 });
  });

  it('câmera lenta 0,5x dobra a duração', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4);
    const p = setSpeed(addClip(project, trackId, c), c.id, 0.5);
    expect(findClip(p, c.id)!.clip.duration).toBe(8);
  });

  it('rejeita velocidade fora do intervalo', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4);
    expect(() => setSpeed(addClip(project, trackId, c), c.id, 40)).toThrow();
  });
});

describe('freezeFrame', () => {
  it('insere o quadro parado e empurra o restante', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 6);
    const after = mediaClip('m2', 6, 2);
    const p = addClip(addClip(project, trackId, c), trackId, after);
    const r = freezeFrame(p, c.id, 3, 2);
    expect(projectDuration(r.project)).toBe(10);
    const f = findClip(r.project, r.freezeId)!.clip;
    expect(f).toMatchObject({ start: 3, duration: 2, freeze: true, sourceIn: 3 });
    expect(findClip(r.project, after.id)!.clip.start).toBe(8);
  });
});

describe('extractAudio', () => {
  it('cria clipe de áudio ligado e silencia o vídeo', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 1, 4);
    const r = extractAudio(addClip(project, trackId, c), c.id);
    const v = findClip(r.project, c.id)!.clip;
    const a = findClip(r.project, r.audioId)!;
    expect(a.track.kind).toBe('audio');
    expect(a.clip.linkId).toBeDefined();
    expect(a.clip.linkId).toBe(v.linkId);
    expect(v.type === 'media' && v.audio.muted).toBe(true);
    expect(() => extractAudio(r.project, c.id)).toThrow();
  });
});

describe('transições', () => {
  it('cria sobreposição e encurta a timeline; remover restaura', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4);
    const b = mediaClip('m2', 4, 4);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    const t = setTransition(p, b.id, 'fade', 1);
    expect(findClip(t, b.id)!.clip.start).toBe(3);
    expect(projectDuration(t)).toBe(7);
    const t2 = setTransition(t, b.id, 'slide-left', 0.5);
    expect(findClip(t2, b.id)!.clip.start).toBe(3.5);
    const r = removeTransition(t2, b.id);
    expect(findClip(r, b.id)!.clip.start).toBe(4);
    expect(projectDuration(r)).toBe(8);
  });

  it('duração acima do limite é recusada', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4);
    const b = mediaClip('m2', 4, 2);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    expect(() => setTransition(p, b.id, 'fade', 2)).toThrow(/duração da transição/);
  });

  it('exige clipes encostados', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4);
    const b = mediaClip('m2', 6, 4);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    expect(() => setTransition(p, b.id, 'fade', 1)).toThrow(/encostados/);
  });
});

describe('removeRanges', () => {
  it('remove pausas e fecha os vãos', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 10);
    const p = addClip(project, trackId, c);
    const r = removeRanges(p, c.id, [
      { start: 2, end: 3 },
      { start: 6, end: 8 },
    ]);
    expect(projectDuration(r)).toBe(7);
    const clips = r.tracks[0]!.clips.map((x) => (x.type === 'media' ? [x.start, x.duration, x.sourceIn] : []));
    expect(clips).toEqual([
      [0, 2, 0],
      [2, 3, 3],
      [5, 2, 8],
    ]);
  });

  it('remove trecho no início do clipe', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 10);
    const r = removeRanges(addClip(project, trackId, c), c.id, [{ start: 0, end: 2 }]);
    expect(projectDuration(r)).toBe(8);
    expect(r.tracks[0]!.clips[0]).toMatchObject({ start: 0, sourceIn: 2 });
  });
});

describe('closeGaps', () => {
  it('encosta os clipes e leva o primeiro a zero', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 2, 2);
    const b = mediaClip('m1', 6, 3);
    const c = mediaClip('m2', 12, 1);
    const p = [a, b, c].reduce((acc, clip) => addClip(acc, trackId, clip), project);
    const r = closeGaps(p, trackId);
    expect(r.tracks[0]!.clips.map((x) => [x.start, x.duration])).toEqual([[0, 2], [2, 3], [5, 1]]);
    expect(projectDuration(r)).toBe(6);
  });

  it('mantém a sobreposição de uma transição ao fechar os vãos', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4);
    const b = mediaClip('m2', 4, 4);
    let p = addClip(addClip(project, trackId, a), trackId, b);
    p = setTransition(p, b.id, 'fade', 1); // b começa em 3
    const gap = moveClipTo(p, b.id, 3);
    const r = closeGaps(gap, trackId);
    expect(findClip(r, b.id)!.clip.start).toBe(3);
  });

  it('não altera faixa bloqueada', () => {
    const { project, trackId } = fixtureProject();
    const p = addClip(project, trackId, mediaClip('m1', 3, 2));
    const locked = setTrackProps(p, trackId, { locked: true });
    expect(() => closeGaps(locked, trackId)).toThrow(/bloqueada/);
  });
});

function moveClipTo(p: Project, id: string, start: number): Project {
  return updateClip(p, id, { start });
}
