import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import { updateClip } from './clips';
import { moveInSequence, sequenceOrder } from './reorder';
import type { MediaClip } from '../schema';

function three(gaps: [number, number] = [0, 0]) {
  const { project, trackId } = fixtureProject();
  const a = mediaClip('m1', 0, 2);
  const b = mediaClip('m1', 2 + gaps[0], 3);
  const c = mediaClip('m1', 5 + gaps[0] + gaps[1], 1);
  let p = project;
  for (const x of [a, b, c]) p = addClip(p, trackId, x);
  return { p, trackId, a, b, c };
}

const starts = (p: ReturnType<typeof three>['p'], trackId: string) => sequenceOrder(p, trackId).map((x) => [x.id, x.start]);

describe('moveInSequence', () => {
  it('troca com o vizinho de trás e repõe as posições em sequência', () => {
    const { p, trackId, a, b, c } = three();
    const out = moveInSequence(p, b.id, -1); // ordem nova: b, a, c
    expect(starts(out, trackId)).toEqual([[b.id, 0], [a.id, 3], [c.id, 5]]);
  });

  it('troca com o vizinho da frente', () => {
    const { p, trackId, a, b, c } = three();
    const out = moveInSequence(p, b.id, 1); // a, c, b
    expect(starts(out, trackId)).toEqual([[a.id, 0], [c.id, 2], [b.id, 3]]);
  });

  it('os vãos continuam nos mesmos encaixes (o 1º vão de 1 s e o 2º de 0,5 s)', () => {
    const { p, trackId, a, b, c } = three([1, 0.5]); // a [0,2] vão 1 b [3,6] vão 0,5 c [6.5,7.5]
    const out = moveInSequence(p, a.id, 1); // b, a, c
    // b: 0–3, vão de 1 s, a: 4–6, vão de 0,5 s, c: a partir de 6,5
    expect(starts(out, trackId)).toEqual([[b.id, 0], [a.id, 4], [c.id, 6.5]]);
  });

  it('é reversível: mover para frente e depois para trás volta ao original', () => {
    const { p, trackId, b } = three([0.25, 0.75]);
    const there = moveInSequence(p, b.id, 1);
    const back = moveInSequence(there, b.id, -1);
    expect(starts(back, trackId)).toEqual(starts(p, trackId));
  });

  it('clipes ligados em outra faixa andam o mesmo tanto', () => {
    const { p, trackId, a, b } = three();
    const au = addTrack(p, 'audio');
    const partner = mediaClip('m1', 0, 2);
    let q = addClip(au.project, au.track.id, partner);
    q = updateClip(q, a.id, (x) => ({ ...x, linkId: 'L' }) as MediaClip);
    q = updateClip(q, partner.id, (x) => ({ ...x, linkId: 'L' }) as MediaClip);
    const out = moveInSequence(q, a.id, 1); // a passa depois de b: 0 → 3
    expect(findClip(out, a.id)!.clip.start).toBe(3);
    expect(findClip(out, partner.id)!.clip.start).toBe(3);
    void trackId;
    void b;
  });

  it('recusa mover o primeiro para trás, o último para frente e faixa bloqueada', () => {
    const { p, a, c } = three();
    expect(() => moveInSequence(p, a.id, -1)).toThrow(/primeiro/);
    expect(() => moveInSequence(p, c.id, 1)).toThrow(/último/);
    const locked = { ...p, tracks: p.tracks.map((t) => ({ ...t, locked: true })) };
    expect(() => moveInSequence(locked, a.id, 1)).toThrow();
  });
});
