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

/** Deixa todos os clipes escolhidos com a mesma duração: a do mais curto, a do mais longo ou a média (arredondada ao quadro). */
export function matchDuration(p: Project, ids: string[], mode: 'shortest' | 'longest' | 'average'): Project {
  const clips = [...new Set(ids)].map((id) => requireClip(p, id).clip);
  if (clips.length < 2) throw new TimelineError('Selecione pelo menos dois clipes', 'OUT_OF_RANGE');
  const durations = clips.map((c) => c.duration);
  const target = mode === 'shortest' ? Math.min(...durations) : mode === 'longest' ? Math.max(...durations) : snapToFrame(durations.reduce((a, b) => a + b, 0) / durations.length, p.settings.fps);
  return setClipsDuration(p, clips.map((c) => c.id), round6(target));
}

/** Escalona a entrada: o clipe mais cedo fica onde está e cada um dos seguintes começa ${offset} s depois do anterior (mesmo em faixas diferentes). */
export function staggerClips(p: Project, ids: string[], offset: number): Project {
  if (!(offset >= 0.05 && offset <= 5)) throw new TimelineError('O intervalo vai de 0,05 s a 5 s', 'OUT_OF_RANGE');
  const found = [...new Set(ids)].map((id) => requireClip(p, id));
  if (found.length < 2) throw new TimelineError('Selecione pelo menos dois clipes', 'OUT_OF_RANGE');
  for (const f of found) assertUnlocked(f.track);
  const order = [...found].sort((a, b) => a.clip.start - b.clip.start || a.trackIndex - b.trackIndex);
  const first = order[0]!.clip.start;
  const starts = new Map(order.map((f, i) => [f.clip.id, round6(first + i * offset)]));
  let next = p;
  const touched = new Set<string>();
  for (const f of found) {
    touched.add(f.track.id);
    next = withTrackClips(next, f.track.id, (cs) => cs.map((c) => (starts.has(c.id) ? { ...c, start: starts.get(c.id)! } : c)));
  }
  assertTracksValid(next, touched);
  return next;
}

/** Ids dos clipes (em faixas desbloqueadas) inteiros dentro de [from, to] ('inside') ou que tocam o trecho ('touching'). */
export function clipIdsInRange(p: Project, from: number, to: number, mode: 'inside' | 'touching' = 'inside'): string[] {
  if (!(to > from)) throw new TimelineError('O fim do trecho precisa vir depois do início', 'OUT_OF_RANGE');
  return allClips(p)
    .filter(({ clip, track }) => !track.locked && (mode === 'inside' ? clip.start >= from - EPS && clipEnd(clip) <= to + EPS : clip.start < to - EPS && clipEnd(clip) > from + EPS))
    .map(({ clip }) => clip.id);
}

/** Põe um marcador no início de cada legenda (com o começo do texto como nome), pulando onde já há marcador. */
export function markersAtCaptions(p: Project): { project: Project; added: number } {
  const caps = allClips(p)
    .filter(({ clip }) => clip.type === 'caption')
    .map(({ clip }) => clip)
    .sort((a, b) => a.start - b.start);
  let markers: Marker[] = p.markers;
  let added = 0;
  for (const c of caps) {
    if (markers.some((m) => Math.abs(m.time - c.start) < 1e-3)) continue;
    const text = c.type === 'caption' ? c.text.trim() : '';
    markers = [...markers, { id: newId('mk'), time: round6(c.start), label: text.length > 32 ? text.slice(0, 31) + '…' : text, color: '#60a5fa' }];
    added++;
  }
  return { project: { ...p, markers: [...markers].sort((a, b) => a.time - b.time) }, added };
}
