import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './mediatools';

function stacked() {
  const { project, trackId } = fixtureProject();
  const t2 = addTrack(project, 'video');
  const t3 = addTrack(t2.project, 'video');
  const a = mediaClip('m1', 1, 2);
  const b = mediaClip('m1', 1, 2); // idêntico a a, em outra faixa
  const c = mediaClip('m1', 1, 2, { sourceIn: 3 }); // outro trecho da origem
  const d = mediaClip('m2', 1, 2); // outra mídia
  let p: Project = addClip(t3.project, trackId, a);
  p = addClip(p, t2.track.id, b);
  p = addClip(p, t3.track.id, c);
  p = addClip(p, trackId, { ...d, start: 5 });
  return { p, a, b, c, d };
}

describe('clipes duplicados', () => {
  it('agrupa só os realmente idênticos', () => {
    const { p, a, b } = stacked();
    expect(ops.findDuplicateClips(p).map((g) => [...g].sort())).toEqual([[a.id, b.id].sort()]);
  });

  it('remove as cópias e mantém um por grupo; sem duplicados não muda nada', () => {
    const { p, a, b } = stacked();
    const r = ops.removeDuplicateClips(p);
    expect(r.removed).toBe(1);
    const left = [findClip(r.project, a.id), findClip(r.project, b.id)].filter(Boolean);
    expect(left).toHaveLength(1);
    expect(ops.removeDuplicateClips(r.project)).toEqual({ project: r.project, removed: 0 });
  });
});
