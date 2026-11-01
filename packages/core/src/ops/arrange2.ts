import { TimelineError } from '../errors';
import { findClip } from '../project';
import type { Clip, MediaClip, Project } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { deleteClips, splitClips, trimClip } from './clips';
import { assertTracksValid, assertUnlocked, minClipDuration, requireClip, withTrackClips } from './helpers';
import { moveInSequence, sequenceOrder } from './reorder';
import { repeatClip } from './repeat';

/** Inverte a ordem dos clipes da faixa (o último vira o primeiro); os vãos continuam nos mesmos encaixes. */
export function reverseSequence(p: Project, trackId: string): Project {
  const ids = sequenceOrder(p, trackId).map((c) => c.id);
  let next = p;
  for (let k = 1; k < ids.length; k++) for (let j = 0; j < k; j++) next = moveInSequence(next, ids[k]!, -1);
  return next;
}
