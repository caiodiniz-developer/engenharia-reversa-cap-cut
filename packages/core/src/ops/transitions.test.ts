import { describe, expect, it } from 'vitest';
import { projectDuration } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import * as ops from './transitions';

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
const clips = (p: Project) => [...p.tracks[0]!.clips].sort((a, b) => a.start - b.start) as MediaClip[];

describe('transições em lote', () => {
  it('aplica em todos os cortes e encurta a timeline pela sobreposição de cada um', () => {
    const { p, trackId } = build([0, 3], [3, 6], [6, 9]);
    const r = ops.setTransitionsOnTrack(p, trackId, 'fade', 0.5);
    expect(r).toMatchObject({ applied: 2, skipped: 0 });
    const c = clips(r.project);
    expect(c[0]!.transitionIn).toBeUndefined();
    expect(c[1]!.transitionIn).toMatchObject({ type: 'fade', duration: 0.5 });
    expect(c[2]!.transitionIn).toMatchObject({ type: 'fade', duration: 0.5 });
    expect(projectDuration(r.project)).toBeCloseTo(9 - 2 * 0.5, 5);
  });

  it('ignora corte com vão e clipe curto demais, e conta os ignorados', () => {
    const { p, trackId } = build([0, 3], [5, 8], [8, 8.2]);
    const r = ops.setTransitionsOnTrack(p, trackId, 'slide-left', 1);
    expect(r.applied).toBe(0); // vão entre os dois primeiros; o terceiro tem 0,2 s (máximo 0,18 s)
    expect(r.skipped).toBe(2);
    expect(r.project).toEqual(p);
  });

  it('remover restaura as posições originais', () => {
    const { p, trackId } = build([0, 3], [3, 6], [6, 9]);
    const withTr = ops.setTransitionsOnTrack(p, trackId, 'fade', 0.5).project;
    const back = ops.removeTransitionsOnTrack(withTr, trackId);
    expect(back.removed).toBe(2);
    expect(clips(back.project).map((c) => [c.start, c.transitionIn])).toEqual([[0, undefined], [3, undefined], [6, undefined]]);
    expect(ops.removeTransitionsOnTrack(back.project, trackId).removed).toBe(0);
  });
});
