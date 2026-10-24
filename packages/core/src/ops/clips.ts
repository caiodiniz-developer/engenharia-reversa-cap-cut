import { TimelineError } from '../errors';
import { newId } from '../ids';
import { splitKeyframes } from '../keyframes';
import { findClip } from '../project';
import { ClipSchema, type CaptionClip, type Clip, type Keyframes, type Project } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import {
  assertClipFitsTrack,
  assertSourceRange,
  assertTracksValid,
  assertUnlocked,
  minClipDuration,
  replaceClip,
  requireClip,
  requireTrack,
  shiftFrom,
  sortClips,
  withTrackClips,
} from './helpers';

/** Insere um clipe numa faixa validando tipo, bloqueio, sobreposição e limites da mídia. */
export function addClip(p: Project, trackId: string, clip: Clip): Project {
  const track = requireTrack(p, trackId);
  assertUnlocked(track);
  const parsed = ClipSchema.parse(clip);
  assertClipFitsTrack(p, parsed, track);
  assertSourceRange(p, parsed);
  const next = withTrackClips(p, trackId, (clips) => [...clips, parsed]);
  assertTracksValid(next, [trackId]);
  return next;
}

/**
 * Move clipes pelo mesmo delta. Se toTrackId for informado, apenas o clipe `primaryId` muda de faixa.
 * A seleção deve vir expandida (veja expandSelection).
 */
export function moveClips(
  p: Project,
  ids: string[],
  delta: number,
  opts: { primaryId?: string; toTrackId?: string } = {},
): Project {
  const set = new Set(ids);
  let minStart = Infinity;
  for (const id of set) minStart = Math.min(minStart, requireClip(p, id).clip.start);
  const d = round6(Math.max(delta, -minStart));
  const touched = new Set<string>();
  let next = p;
  for (const id of set) {
    const { track, clip } = requireClip(p, id);
    assertUnlocked(track);
    const moved = { ...clip, start: round6(clip.start + d) } as Clip;
    const targetId = opts.primaryId === id && opts.toTrackId ? opts.toTrackId : track.id;
    const target = requireTrack(p, targetId);
    assertUnlocked(target);
    assertClipFitsTrack(p, moved, target);
    touched.add(track.id).add(target.id);
    if (targetId === track.id) next = replaceClip(next, moved);
    else {
      next = withTrackClips(next, track.id, (cs) => cs.filter((c) => c.id !== id));
      next = withTrackClips(next, targetId, (cs) => [...cs, moved]);
    }
  }
  assertTracksValid(next, touched);
  return next;
}

/** Move um único clipe para um novo instante/faixa. */
export function moveClip(p: Project, clipId: string, opts: { start?: number; trackId?: string }): Project {
  const { clip } = requireClip(p, clipId);
  const delta = (opts.start ?? clip.start) - clip.start;
  return moveClips(p, [clipId], delta, { primaryId: clipId, toTrackId: opts.trackId });
}

function splitCaptionWords(c: CaptionClip, at: number): { left: CaptionClip['words']; right: CaptionClip['words'] } {
  const left = c.words.filter((w) => w.start < at).map((w) => ({ ...w, end: Math.min(w.end, at) }));
  const right = c.words.filter((w) => w.end > at).map((w) => ({ ...w, start: round6(Math.max(0, w.start - at)), end: round6(w.end - at) }));
  return { left, right };
}

function splitKeyframeSet(k: Keyframes, at: number, clip: Clip): { left: Keyframes; right: Keyframes } {
  const base = clip.type === 'media' || clip.type === 'text' || clip.type === 'caption' ? clip : undefined;
  const fallback = (prop: keyof Keyframes): number => {
    if (prop === 'volume') return clip.type === 'media' ? clip.audio.volume : 1;
    return base ? (base.transform[prop] as number) : 0;
  };
  const left: Keyframes = {};
  const right: Keyframes = {};
  for (const prop of Object.keys(k) as Array<keyof Keyframes>) {
    const s = splitKeyframes(k[prop], at, fallback(prop));
    if (s.left) left[prop] = s.left;
    if (s.right) right[prop] = s.right;
  }
  return { left, right };
}

function splitOne(clip: Clip, time: number): [Clip, Clip] {
  const d1 = round6(time - clip.start);
  const d2 = round6(clip.duration - d1);
  const kf = splitKeyframeSet(clip.keyframes, d1, clip);
  const rightId = newId('clp');
  if (clip.type === 'media') {
    let leftIn = clip.sourceIn;
    let rightIn = clip.sourceIn;
    if (!clip.freeze) {
      if (!clip.reverse) rightIn = round6(clip.sourceIn + d1 * clip.speed);
      else leftIn = round6(clip.sourceIn + d2 * clip.speed);
    }
    const left: Clip = {
      ...clip,
      duration: d1,
      sourceIn: leftIn,
      keyframes: kf.left,
      audio: { ...clip.audio, fadeOut: 0 },
    };
    const right: Clip = {
      ...clip,
      id: rightId,
      start: round6(time),
      duration: d2,
      sourceIn: rightIn,
      keyframes: kf.right,
      transitionIn: undefined,
      audio: { ...clip.audio, fadeIn: 0 },
      effects: clip.effects.map((e) => ({ ...e, id: newId('fx'), params: { ...e.params } })),
    };
    return [left, right];
  }
  if (clip.type === 'caption') {
    const w = splitCaptionWords(clip, d1);
    const text = (words: CaptionClip['words']) => (words.length ? words.map((x) => x.text).join(' ') : clip.text);
    return [
      { ...clip, duration: d1, keyframes: kf.left, words: w.left, text: text(w.left) },
      { ...clip, id: rightId, start: round6(time), duration: d2, keyframes: kf.right, words: w.right, text: text(w.right) },
    ];
  }
  return [
    { ...clip, duration: d1, keyframes: kf.left },
    { ...clip, id: rightId, start: round6(time), duration: d2, keyframes: kf.right },
  ];
}

/**
 * Divide os clipes no instante `time`. Clipes que compartilhavam linkId continuam ligados entre si
 * nas duas metades. Devolve o mapa esquerda->direita para ajustar a seleção.
 */
export function splitClips(p: Project, ids: string[], time: number): { project: Project; rightIds: Record<string, string> } {
  const min = minClipDuration(p);
  const linkMap = new Map<string, string>();
  const rightIds: Record<string, string> = {};
  let next = p;
  const touched = new Set<string>();
  for (const id of new Set(ids)) {
    const { track, clip } = requireClip(next, id);
    assertUnlocked(track);
    if (time < clip.start + min - EPS || time > clipEnd(clip) - min + EPS) {
      throw new TimelineError('O ponto de divisão precisa estar dentro do clipe (a pelo menos 1 quadro das bordas)', 'OUT_OF_RANGE');
    }
    const [left, right] = splitOne(clip, round6(time));
    if (right.linkId) {
      if (!linkMap.has(right.linkId)) linkMap.set(right.linkId, newId('lnk'));
      right.linkId = linkMap.get(right.linkId);
    }
    rightIds[id] = right.id;
    touched.add(track.id);
    next = withTrackClips(next, track.id, (cs) => [...cs.filter((c) => c.id !== id), left, right]);
  }
  assertTracksValid(next, touched);
  return { project: next, rightIds };
}

export function splitClip(p: Project, clipId: string, time: number): { project: Project; rightId: string } {
  const r = splitClips(p, [clipId], time);
  return { project: r.project, rightId: r.rightIds[clipId]! };
}

/** Desloca a origem dos keyframes quando o início do clipe muda por delta (delta>0 = corte no início). */
function shiftKeyframeOrigin(clip: Clip, delta: number): Keyframes {
  const out: Keyframes = {};
  for (const prop of Object.keys(clip.keyframes) as Array<keyof Keyframes>) {
    const kfs = clip.keyframes[prop];
    if (!kfs) continue;
    if (delta > 0) {
      const fallback = prop === 'volume' ? (clip.type === 'media' ? clip.audio.volume : 1) : (clip.transform[prop] as number);
      const r = splitKeyframes(kfs, delta, fallback).right;
      if (r) out[prop] = r;
    } else {
      out[prop] = kfs.map((k) => ({ ...k, time: round6(k.time - delta) }));
    }
  }
  return out;
}

/** Ajusta a borda inicial ou final de um clipe para `time` (instante absoluto na timeline). */
export function trimClip(p: Project, clipId: string, edge: 'start' | 'end', time: number): Project {
  const { track, clip } = requireClip(p, clipId);
  assertUnlocked(track);
  const min = minClipDuration(p);
  let next: Clip;
  if (edge === 'end') {
    const duration = round6(time - clip.start);
    if (duration < min - EPS) throw new TimelineError('Duração mínima de 1 quadro', 'OUT_OF_RANGE');
    next = { ...clip, duration } as Clip;
    if (clip.type === 'media' && clip.reverse && !clip.freeze) {
      next = { ...next, sourceIn: round6(clip.sourceIn + (clip.duration - duration) * clip.speed) } as Clip;
    }
  } else {
    const delta = round6(time - clip.start);
    const duration = round6(clip.duration - delta);
    if (duration < min - EPS) throw new TimelineError('Duração mínima de 1 quadro', 'OUT_OF_RANGE');
    if (time < 0) throw new TimelineError('Início antes de zero', 'OUT_OF_RANGE');
    next = { ...clip, start: round6(time), duration, keyframes: shiftKeyframeOrigin(clip, delta) } as Clip;
    if (clip.type === 'media' && !clip.reverse && !clip.freeze) {
      next = { ...next, sourceIn: round6(clip.sourceIn + delta * clip.speed) } as Clip;
    }
    if (clip.type === 'media') next = { ...next, transitionIn: undefined } as Clip;
    if (clip.type === 'caption') {
      const w = clip.words
        .filter((x) => x.end > delta)
        .map((x) => ({ ...x, start: round6(Math.max(0, x.start - delta)), end: round6(x.end - delta) }));
      next = { ...next, words: w } as Clip;
    }
  }
  assertSourceRange(p, next);
  const out = replaceClip(p, next);
  assertTracksValid(out, [track.id]);
  return out;
}

/** Remove clipes. Com ripple, os clipes posteriores da mesma faixa fecham o espaço. */
export function deleteClips(p: Project, ids: string[], opts: { ripple?: boolean } = {}): Project {
  const set = new Set(ids);
  let next = p;
  for (const track of p.tracks) {
    const removed = track.clips.filter((c) => set.has(c.id));
    if (removed.length === 0) continue;
    assertUnlocked(track);
    let clips = track.clips.filter((c) => !set.has(c.id));
    if (opts.ripple) {
      // Intervalos removidos mesclados; cada clipe restante recua a soma dos intervalos anteriores a ele.
      const intervals = removed.map((c) => [c.start, clipEnd(c)] as const).sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];
      for (const [s, e] of intervals) {
        const last = merged[merged.length - 1];
        if (last && s <= last[1] + EPS) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
      }
      clips = clips.map((c) => {
        let shift = 0;
        for (const [s, e] of merged) if (c.start >= e - EPS) shift += e - s;
        return shift ? ({ ...c, start: round6(c.start - shift) } as Clip) : c;
      });
    }
    next = withTrackClips(next, track.id, () => clips);
  }
  for (const id of set) if (!findClip(p, id)) throw new TimelineError(`Clipe ${id} não encontrado`, 'NOT_FOUND');
  assertTracksValid(next, next.tracks.map((t) => t.id));
  return next;
}

/** Duplica clipes logo após o fim da seleção (na mesma faixa; se não couber, ao fim da faixa). */
export function duplicateClips(p: Project, ids: string[]): { project: Project; newIds: Record<string, string> } {
  const src = [...new Set(ids)].map((id) => requireClip(p, id));
  const minStart = Math.min(...src.map((s) => s.clip.start));
  const maxEnd = Math.max(...src.map((s) => clipEnd(s.clip)));
  const span = round6(maxEnd - minStart);
  const newIds: Record<string, string> = {};
  const linkMap = new Map<string, string>();
  const groupMap = new Map<string, string>();
  let next = p;
  for (const { track, clip } of src) {
    assertUnlocked(track);
    const copy: Clip = JSON.parse(JSON.stringify(clip));
    copy.id = newId('clp');
    newIds[clip.id] = copy.id;
    if (copy.linkId) copy.linkId = linkMap.get(copy.linkId) ?? (linkMap.set(copy.linkId, newId('lnk')), linkMap.get(copy.linkId)!);
    if (copy.groupId) copy.groupId = groupMap.get(copy.groupId) ?? (groupMap.set(copy.groupId, newId('grp')), groupMap.get(copy.groupId)!);
    if (copy.type === 'media') {
      copy.transitionIn = undefined;
      copy.effects = copy.effects.map((e) => ({ ...e, id: newId('fx') }));
    }
    copy.start = round6(clip.start + span);
    const cur = requireTrack(next, track.id);
    const conflict = cur.clips.some((c) => c.start < clipEnd(copy) - EPS && clipEnd(c) > copy.start + EPS);
    if (conflict) copy.start = round6(Math.max(0, ...cur.clips.map(clipEnd)));
    next = withTrackClips(next, track.id, (cs) => [...cs, copy]);
  }
  assertTracksValid(next, src.map((s) => s.track.id));
  return { project: next, newIds };
}

/** Aplica um patch raso a um clipe, revalida pelo schema e checa sobreposição e limites. */
export function updateClip(p: Project, clipId: string, patch: Partial<Clip> | ((c: Clip) => Clip)): Project {
  const { track, clip } = requireClip(p, clipId);
  assertUnlocked(track);
  const merged = typeof patch === 'function' ? patch(clip) : ({ ...clip, ...patch } as Clip);
  const parsed = ClipSchema.parse({ ...merged, id: clip.id });
  assertSourceRange(p, parsed);
  const next = replaceClip(p, parsed);
  assertTracksValid(next, [track.id]);
  return next;
}

/** Une um conjunto de ids com seus clipes ligados (linkId) e agrupados (groupId). */
export function expandSelection(p: Project, ids: Iterable<string>, opts: { links?: boolean; groups?: boolean } = {}): string[] {
  const { links = true, groups = true } = opts;
  const result = new Set<string>();
  const linkIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const id of ids) {
    const f = findClip(p, id);
    if (!f) continue;
    result.add(id);
    if (links && f.clip.linkId) linkIds.add(f.clip.linkId);
    if (groups && f.clip.groupId) groupIds.add(f.clip.groupId);
  }
  for (const t of p.tracks)
    for (const c of t.clips) {
      if ((c.linkId && linkIds.has(c.linkId)) || (c.groupId && groupIds.has(c.groupId))) result.add(c.id);
    }
  return [...result];
}

export { shiftFrom, sortClips };
