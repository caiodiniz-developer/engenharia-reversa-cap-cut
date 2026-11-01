import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { updateClip } from './clips';
import { addMarker, addTrack } from './tracks';
import * as ops from './arrange2';

/** Projeto com uma faixa de vídeo e clipes [início, fim] de m1 (10 s), na ordem dada. */
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
const startOf = (p: Project, id: string) => findClip(p, id)!.clip.start;
const endOf = (p: Project, id: string) => findClip(p, id)!.clip.start + findClip(p, id)!.clip.duration;

describe('reverseSequence', () => {
  it('o último vira o primeiro e os vãos ficam nos mesmos encaixes', () => {
    const { p, trackId, ids } = build([0, 2], [3, 6], [6.5, 7.5]); // vãos de 1 s e 0,5 s
    const out = ops.reverseSequence(p, trackId);
    expect(startOf(out, ids[2]!)).toBe(0);
    expect(startOf(out, ids[1]!)).toBe(2);
    expect(startOf(out, ids[0]!)).toBe(5.5);
  });

  it('inverter duas vezes volta ao original e uma faixa de um clipe não muda', () => {
    const { p, trackId, ids } = build([0, 2], [2, 5], [7, 8]);
    const twice = ops.reverseSequence(ops.reverseSequence(p, trackId), trackId);
    for (const id of ids) expect(startOf(twice, id)).toBe(startOf(p, id));
    const one = build([1, 2]);
    expect(ops.reverseSequence(one.p, one.trackId)).toEqual(one.p);
  });
});
