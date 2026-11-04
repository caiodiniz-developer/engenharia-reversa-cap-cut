import { TimelineError } from '../errors';
import { allClips } from '../project';
import type { Marker, Project, Track } from '../schema';
import { newId } from '../ids';
import { EPS, clipEnd, round6, snapToFrame } from '../time';
import { setClipsDuration } from './duration';
import { assertTracksValid, assertUnlocked, requireClip, withTrackClips } from './helpers';
import { addTrack } from './tracks';

/**
 * Move os clipes (que precisam estar na mesma faixa) para a faixa vizinha do mesmo tipo, acima (-1) ou abaixo (1), no mesmo
 * instante. Se não houver faixa do tipo nessa direção, cria uma. Falha se baterem em algum clipe da faixa de destino.
 */
export function sendToAdjacentTrack(p: Project, ids: string[], dir: -1 | 1): { project: Project; trackId: string } {
  const found = [...new Set(ids)].map((id) => requireClip(p, id));
  if (!found.length) throw new TimelineError('Selecione os clipes que vão mudar de faixa', 'OUT_OF_RANGE');
  const source = found[0]!.track;
  if (found.some((f) => f.track.id !== source.id)) throw new TimelineError('Os clipes precisam estar na mesma faixa', 'INVALID');
  assertUnlocked(source);
  const idx = p.tracks.findIndex((t) => t.id === source.id);
  let target: Track | undefined;
  for (let j = idx + dir; j >= 0 && j < p.tracks.length; j += dir) {
    if (p.tracks[j]!.kind === source.kind) {
      target = p.tracks[j];
      break;
    }
  }
  let next = p;
  if (!target) {
    const r = addTrack(p, source.kind, { index: dir < 0 ? idx : idx + 1 });
    next = r.project;
    target = r.track;
  }
  assertUnlocked(target);
  const moving = found.map((f) => f.clip);
  const set = new Set(moving.map((c) => c.id));
  next = withTrackClips(next, source.id, (cs) => cs.filter((c) => !set.has(c.id)));
  next = withTrackClips(next, target.id, (cs) => [...cs, ...moving]);
  assertTracksValid(next, [source.id, target.id]);
  return { project: next, trackId: target.id };
}

/** Remove todas as faixas que não têm nenhum clipe. */
export function removeEmptyTracks(p: Project): { project: Project; removed: number } {
  const keep = p.tracks.filter((t) => t.clips.length > 0);
  return { project: keep.length === p.tracks.length ? p : { ...p, tracks: keep }, removed: p.tracks.length - keep.length };
}
