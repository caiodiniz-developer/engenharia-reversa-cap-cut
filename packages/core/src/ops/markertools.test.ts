import { describe, expect, it } from 'vitest';
import type { Project, Track } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker, addTrack } from './tracks';
import * as ops from './markertools';

function build(...spans: Array<[number, number]>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, ids, trackId };
}

describe('markersEvery', () => {
  it('a cada 2 s num projeto de 7 s: 2, 4 e 6', () => {
    const { p } = build([0, 7]);
    const r = ops.markersEvery(p, 2);
    expect(r.added).toBe(3);
    expect(r.project.markers.map((m) => [m.time, m.label])).toEqual([[2, 'Marca 1'], [4, 'Marca 2'], [6, 'Marca 3']]);
  });

  it('não duplica onde já existe marcador e recusa intervalo pequeno, excesso e projeto vazio', () => {
    const { p } = build([0, 7]);
    const r = ops.markersEvery(addMarker(p, 4).project, 2);
    expect(r.added).toBe(2);
    expect(() => ops.markersEvery(p, 0.05)).toThrow();
    expect(ops.markersEvery(build([0, 10]).p, 0.1, 'x').added).toBe(99);
    expect(() => ops.markersEvery(fixtureProject().project, 1)).toThrow(/vazio/);
  });
});

describe('markersAtClipStarts', () => {
  it('um marcador por início, com o nome da mídia', () => {
    const { p } = build([0, 2], [3, 5]);
    const r = ops.markersAtClipStarts(p);
    expect(r.added).toBe(2);
    expect(r.project.markers.map((m) => [m.time, m.label])).toEqual([[0, 'm1.mp4'], [3, 'm1.mp4']]);
  });

  it('respeita a seleção e não duplica', () => {
    const { p, ids } = build([0, 2], [3, 5]);
    const a = ops.markersAtClipStarts(p, [ids[1]!]);
    expect(a.project.markers.map((m) => m.time)).toEqual([3]);
    expect(ops.markersAtClipStarts(a.project).added).toBe(1);
  });
});
