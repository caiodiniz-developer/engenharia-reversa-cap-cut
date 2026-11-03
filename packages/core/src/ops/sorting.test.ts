import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import * as ops from './sorting';

function build(items: Array<{ media: string; start: number; duration: number }>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const it of items) {
    const c = mediaClip(it.media, it.start, it.duration);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, trackId, ids };
}
const order = (p: Project) => [...p.tracks[0]!.clips].sort((a, b) => a.start - b.start).map((c) => c.id);

describe('sortSequence', () => {
  it('do mais curto ao mais longo e ao contrário, mantendo os vãos nos encaixes', () => {
    const { p, trackId, ids } = build([
      { media: 'm1', start: 0, duration: 3 },
      { media: 'm1', start: 4, duration: 1 }, // vão de 1 s depois do primeiro
      { media: 'm1', start: 5, duration: 2 },
    ]);
    const asc = ops.sortSequence(p, trackId, 'duration-asc');
    expect(order(asc)).toEqual([ids[1], ids[2], ids[0]]);
    expect(findClip(asc, ids[1]!)!.clip.start).toBe(0);
    expect(findClip(asc, ids[2]!)!.clip.start).toBe(2); // 0 + 1 (duração) + 1 (vão preservado)
    expect(findClip(asc, ids[0]!)!.clip.start).toBe(4); // 2 + 2
    expect(order(ops.sortSequence(p, trackId, 'duration-desc'))).toEqual([ids[0], ids[2], ids[1]]);
  });

  it('por nome da mídia, em ordem natural (m2 antes de m10)', () => {
    const { p, trackId } = build([
      { media: 'm2', start: 0, duration: 1 },
      { media: 'm1', start: 1, duration: 1 },
    ]);
    const named = ops.sortSequence(p, trackId, 'name');
    expect(order(named).map((id) => (findClip(named, id)!.clip as { mediaId: string }).mediaId)).toEqual(['m1', 'm2']);
    const again = ops.sortSequence(named, trackId, 'name');
    expect(again).toEqual(named);
  });
});
