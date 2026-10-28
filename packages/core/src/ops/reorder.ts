import { TimelineError } from '../errors';
import type { Clip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { assertTracksValid, assertUnlocked, requireClip, requireTrack, withTrackClips } from './helpers';

/** Clipes de uma faixa na ordem em que aparecem na timeline. */
export function sequenceOrder(p: Project, trackId: string): Clip[] {
  return [...requireTrack(p, trackId).clips].sort((a, b) => a.start - b.start || a.duration - b.duration);
}

/**
 * Troca o clipe de lugar com o vizinho (dir = -1 para antes, 1 para depois) na mesma faixa.
 * Os vãos entre clipes continuam nos mesmos "encaixes": só os clipes trocam de posição. Clipes ligados
 * (ex.: o áudio extraído de um vídeo) andam o mesmo tanto que o parceiro.
 */
export function moveInSequence(p: Project, clipId: string, dir: -1 | 1): Project {
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  const order = sequenceOrder(p, track.id);
  const i = order.findIndex((c) => c.id === clipId);
  const j = i + dir;
  if (j < 0 || j >= order.length) throw new TimelineError(dir < 0 ? 'Este já é o primeiro clipe da faixa' : 'Este já é o último clipe da faixa', 'OUT_OF_RANGE');

  const gaps = order.slice(0, -1).map((c, k) => round6(order[k + 1]!.start - clipEnd(c)));
  const next = [...order];
  [next[i], next[j]] = [next[j]!, next[i]!];
  const starts = new Map<string, number>();
  let cursor = order[0]!.start;
  next.forEach((c, k) => {
    starts.set(c.id, round6(cursor));
    cursor = round6(cursor + c.duration + (gaps[k] ?? 0));
  });

  // quanto cada clipe andou; parceiros ligados andam o mesmo
  const delta = new Map<string, number>();
  for (const c of order) delta.set(c.id, round6(starts.get(c.id)! - c.start));
  const linkDelta = new Map<string, number>();
  for (const c of order) if (c.linkId && Math.abs(delta.get(c.id)!) > 1e-9) linkDelta.set(c.linkId, delta.get(c.id)!);

  let out = withTrackClips(p, track.id, (cs) => cs.map((c) => (starts.has(c.id) ? ({ ...c, start: starts.get(c.id)! } as Clip) : c)));
  const touched = new Set([track.id]);
  for (const t of p.tracks) {
    if (t.id === track.id) continue;
    const partners = t.clips.filter((c) => c.linkId && linkDelta.has(c.linkId));
    if (!partners.length) continue;
    assertUnlocked(t);
    touched.add(t.id);
    out = withTrackClips(out, t.id, (cs) => cs.map((c) => (c.linkId && linkDelta.has(c.linkId) ? ({ ...c, start: round6(Math.max(0, c.start + linkDelta.get(c.linkId)!)) } as Clip) : c)));
  }
  assertTracksValid(out, touched);
  return out;
}
