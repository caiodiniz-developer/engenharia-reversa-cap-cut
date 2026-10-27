import { newId } from '../ids';
import type { Clip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { assertTracksValid, assertUnlocked, requireClip, withTrackClips } from './helpers';
import { TimelineError } from '../errors';

export const MAX_REPEATS = 50;

/**
 * Repete o clipe `times` vezes logo depois dele, uma cópia encostada na outra (mesma faixa).
 * Falha se as cópias baterem em outro clipe da faixa. Devolve também os ids das cópias, em ordem.
 */
export function repeatClip(p: Project, clipId: string, times: number): { project: Project; newIds: string[] } {
  if (!Number.isInteger(times) || times < 1 || times > MAX_REPEATS) throw new TimelineError(`Repita de 1 a ${MAX_REPEATS} vezes`, 'OUT_OF_RANGE');
  const { track, clip } = requireClip(p, clipId);
  assertUnlocked(track);
  const copies: Clip[] = [];
  let cursor = clipEnd(clip);
  for (let i = 0; i < times; i++) {
    const copy: Clip = JSON.parse(JSON.stringify(clip));
    copy.id = newId('clp');
    copy.start = round6(cursor);
    // cópias independentes: sem ligação, sem grupo e sem transição (que dependeria do clipe anterior)
    copy.linkId = undefined;
    copy.groupId = undefined;
    if (copy.type === 'media') {
      copy.transitionIn = undefined;
      copy.effects = copy.effects.map((e) => ({ ...e, id: newId('fx') }));
    }
    copies.push(copy);
    cursor = clipEnd(copy);
  }
  const next = withTrackClips(p, track.id, (cs) => [...cs, ...copies]);
  assertTracksValid(next, [track.id]);
  return { project: next, newIds: copies.map((c) => c.id) };
}
