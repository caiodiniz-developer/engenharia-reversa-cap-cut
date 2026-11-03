import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { addClip, expandSelection, moveClips, trimClip } from './clips';
import { assertUnlocked, requireClip } from './helpers';

const times = (p: Project) => p.markers.map((m) => m.time).sort((a, b) => a - b);

/** Leva o início de cada clipe ao marcador mais próximo, se estiver a até ${tolerance} s. Clipes que bateriam em outro ficam onde estão. */
export function snapClipsToMarkers(p: Project, ids: string[], tolerance = 0.5): { project: Project; moved: number; skipped: number } {
  if (!(tolerance > 0 && tolerance <= 5)) throw new TimelineError('A tolerância vai de 0 a 5 s', 'OUT_OF_RANGE');
  const marks = times(p);
  if (!marks.length) throw new TimelineError('Não há marcadores no projeto', 'NOT_FOUND');
  let next = p;
  let moved = 0;
  let skipped = 0;
  const done = new Set<string>();
  for (const id of ids) {
    if (done.has(id)) continue;
    const { clip } = requireClip(next, id);
    const nearest = marks.reduce((best, t) => (Math.abs(t - clip.start) < Math.abs(best - clip.start) ? t : best), marks[0]!);
    const delta = round6(nearest - clip.start);
    if (Math.abs(delta) < 1e-6 || Math.abs(delta) > tolerance) continue;
    const group = expandSelection(next, [id]);
    group.forEach((g) => done.add(g));
    try {
      next = moveClips(next, group, delta);
      moved++;
    } catch (e) {
      if (!(e instanceof TimelineError)) throw e;
      skipped++;
    }
  }
  return { project: next, moved, skipped };
}

/** Faz o fim de cada clipe coincidir com o primeiro marcador depois do início dele (aparando ou estendendo, se a mídia alcançar). */
export function stretchToNextMarker(p: Project, ids: string[]): { project: Project; changed: number; skipped: number } {
  const marks = times(p);
  if (!marks.length) throw new TimelineError('Não há marcadores no projeto', 'NOT_FOUND');
  let next = p;
  let changed = 0;
  let skipped = 0;
  for (const id of new Set(ids)) {
    const { clip, track } = requireClip(next, id);
    assertUnlocked(track);
    const target = marks.find((t) => t > clip.start + 1e-3);
    if (target === undefined || Math.abs(target - clipEnd(clip)) < 1e-6) continue;
    try {
      for (const g of expandSelection(next, [id])) next = trimClip(next, g, 'end', target);
      changed++;
    } catch (e) {
      if (!(e instanceof TimelineError)) throw e;
      skipped++;
    }
  }
  return { project: next, changed, skipped };
}
