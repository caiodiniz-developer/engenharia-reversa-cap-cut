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

/** Gerador pseudoaleatório determinístico (mulberry32): a mesma semente repete a mesma sequência em [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha (Fisher–Yates) com gerador de números pseudoaleatórios de semente fixa: a mesma semente dá sempre a mesma ordem. */
export function shuffledOrder<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Embaralha a ordem dos clipes da faixa; os vãos ficam nos mesmos encaixes e a mesma semente repete o resultado. */
export function shuffleSequence(p: Project, trackId: string, seed: number): Project {
  const target = shuffledOrder(sequenceOrder(p, trackId).map((c) => c.id), seed);
  let next = p;
  for (let i = 0; i < target.length; i++) {
    let pos = sequenceOrder(next, trackId).findIndex((c) => c.id === target[i]);
    while (pos > i) {
      next = moveInSequence(next, target[i]!, -1);
      pos--;
    }
  }
  return next;
}

export type AlignMode = 'start' | 'end' | 'center';

/** Alinha os clipes escolhidos (podem estar em faixas diferentes) ao início do primeiro, ao fim do último ou ao centro do conjunto. */
export function alignClips(p: Project, ids: string[], mode: AlignMode): Project {
  const found = [...new Set(ids)].map((id) => requireClip(p, id));
  if (found.length < 2) throw new TimelineError('Selecione pelo menos dois clipes para alinhar', 'OUT_OF_RANGE');
  for (const f of found) assertUnlocked(f.track);
  const lo = Math.min(...found.map((f) => f.clip.start));
  const hi = Math.max(...found.map((f) => clipEnd(f.clip)));
  const target = new Map<string, number>();
  for (const f of found) {
    const c = f.clip;
    target.set(c.id, round6(Math.max(0, mode === 'start' ? lo : mode === 'end' ? hi - c.duration : (lo + hi) / 2 - c.duration / 2)));
  }
  let next = p;
  const touched = new Set<string>();
  for (const f of found) {
    touched.add(f.track.id);
    next = withTrackClips(next, f.track.id, (cs) => cs.map((c) => (target.has(c.id) ? ({ ...c, start: target.get(c.id)! } as Clip) : c)));
  }
  assertTracksValid(next, touched);
  return next;
}

function sameTrack(p: Project, ids: string[], min: number, what: string) {
  const found = [...new Set(ids)].map((id) => requireClip(p, id));
  if (found.length < min) throw new TimelineError('Selecione pelo menos ' + min + ' clipes para ' + what, 'OUT_OF_RANGE');
  const track = found[0]!.track;
  if (found.some((f) => f.track.id !== track.id)) throw new TimelineError('Os clipes precisam estar na mesma faixa', 'KIND_MISMATCH');
  assertUnlocked(track);
  return { track, clips: found.map((f) => f.clip).sort((a, b) => a.start - b.start) };
}

/** Deixa vãos iguais entre os clipes escolhidos, mantendo o início do primeiro e o fim do último (mesma faixa, 3 ou mais). */
export function distributeClips(p: Project, ids: string[]): Project {
  const { track, clips } = sameTrack(p, ids, 3, 'distribuir');
  const first = clips[0]!.start;
  const last = clipEnd(clips[clips.length - 1]!);
  const free = last - first - clips.reduce((n, c) => n + c.duration, 0);
  if (free < -EPS) throw new TimelineError('Os clipes se sobrepõem: não há espaço para distribuir', 'OVERLAP');
  const gap = free / (clips.length - 1);
  const starts = new Map<string, number>();
  let cursor = first;
  for (const c of clips) {
    starts.set(c.id, round6(cursor));
    cursor += c.duration + gap;
  }
  const next = withTrackClips(p, track.id, (cs) => cs.map((c) => (starts.has(c.id) ? ({ ...c, start: starts.get(c.id)! } as Clip) : c)));
  assertTracksValid(next, [track.id]);
  return next;
}

/** Coloca os clipes escolhidos em sequência com um vão fixo (segundos) entre eles, a partir do início do primeiro. */
export function spaceClips(p: Project, ids: string[], gap: number): Project {
  if (!(gap >= 0) || !Number.isFinite(gap)) throw new TimelineError('O vão precisa ser zero ou maior', 'OUT_OF_RANGE');
  const { track, clips } = sameTrack(p, ids, 2, 'espaçar');
  const starts = new Map<string, number>();
  let cursor = clips[0]!.start;
  for (const c of clips) {
    starts.set(c.id, round6(cursor));
    cursor += c.duration + gap;
  }
  const next = withTrackClips(p, track.id, (cs) => cs.map((c) => (starts.has(c.id) ? ({ ...c, start: starts.get(c.id)! } as Clip) : c)));
  assertTracksValid(next, [track.id]);
  return next;
}

/** Divide o clipe em pedaços de ${seconds} segundos (o último pode ser menor). Devolve os ids na ordem. No máximo 200 pedaços. */
export function splitEvery(p: Project, clipId: string, seconds: number): { project: Project; ids: string[] } {
  if (!(seconds > 0) || !Number.isFinite(seconds)) throw new TimelineError('O intervalo precisa ser maior que zero', 'OUT_OF_RANGE');
  const { clip } = requireClip(p, clipId);
  const min = minClipDuration(p);
  if (clip.duration / seconds > 200) throw new TimelineError('Isso criaria pedaços demais (máximo 200)', 'OUT_OF_RANGE');
  const end = clipEnd(clip);
  let next = p;
  let current = clipId;
  const ids = [clipId];
  for (let k = 1; ; k++) {
    const t = round6(clip.start + k * seconds);
    if (t > end - min + EPS) break;
    const r = splitClips(next, [current], t);
    next = r.project;
    current = r.rightIds[current]!;
    ids.push(current);
  }
  return { project: next, ids };
}

/** Divide o clipe em ${parts} partes de mesma duração (2 a 100). Devolve os ids na ordem. */
export function splitIntoParts(p: Project, clipId: string, parts: number): { project: Project; ids: string[] } {
  if (!Number.isInteger(parts) || parts < 2 || parts > 100) throw new TimelineError('Escolha de 2 a 100 partes', 'OUT_OF_RANGE');
  const { clip } = requireClip(p, clipId);
  let next = p;
  let current = clipId;
  const ids = [clipId];
  for (let k = 1; k < parts; k++) {
    const r = splitClips(next, [current], round6(clip.start + (clip.duration * k) / parts));
    next = r.project;
    current = r.rightIds[current]!;
    ids.push(current);
  }
  return { project: next, ids };
}

const lookOf = (c: MediaClip) =>
  JSON.stringify({ m: c.mediaId, s: c.speed, r: c.reverse, f: c.freeze, t: c.transform, a: c.audio, fx: c.effects.map((e) => ({ type: e.type, enabled: e.enabled, params: e.params })), k: c.mask, st: c.stabilize });

/**
 * Une clipes seguidos da mesma mídia que são continuação um do outro (o fim de um é o começo do próximo, tanto na
 * timeline quanto na origem) e têm o mesmo visual, som e efeitos. É o inverso de dividir. Ignora clipes ligados,
 * com keyframes, invertidos, congelados ou com transição.
 */
export function joinContiguous(p: Project, trackId: string): { project: Project; merged: number } {
  const order = sequenceOrder(p, trackId);
  assertUnlocked(requireTrackOf(p, trackId));
  const keep: Clip[] = [];
  let merged = 0;
  const plain = (c: Clip): c is MediaClip => c.type === 'media' && !c.linkId && !c.reverse && !c.freeze && !c.transitionIn && Object.keys(c.keyframes).length === 0;
  for (const c of order) {
    const prev = keep[keep.length - 1];
    if (prev && plain(prev) && plain(c) && Math.abs(c.start - clipEnd(prev)) < 1e-5 && Math.abs(c.sourceIn - (prev.sourceIn + prev.duration * prev.speed)) < 1e-4 && lookOf(prev) === lookOf(c)) {
      keep[keep.length - 1] = { ...prev, duration: round6(prev.duration + c.duration) } as Clip;
      merged++;
    } else keep.push(c);
  }
  if (!merged) return { project: p, merged: 0 };
  const next = withTrackClips(p, trackId, () => keep);
  assertTracksValid(next, [trackId]);
  return { project: next, merged };
}

function requireTrackOf(p: Project, trackId: string) {
  const t = p.tracks.find((x) => x.id === trackId);
  if (!t) throw new TimelineError('Faixa não encontrada', 'NOT_FOUND');
  return t;
}

/** Arredonda início e fim de todos os clipes ao quadro mais próximo (a duração nunca fica menor que 1 quadro). Devolve quantos mudaram. */
export function snapToFrameGrid(p: Project): { project: Project; changed: number } {
  const fps = p.settings.fps;
  let changed = 0;
  const tracks = p.tracks.map((t) => ({
    ...t,
    clips: t.locked
      ? t.clips
      : t.clips.map((c) => {
          const start = round6(Math.round(c.start * fps) / fps);
          const end = Math.max(round6(Math.round(clipEnd(c) * fps) / fps), round6(start + 1 / fps));
          const duration = round6(end - start);
          if (Math.abs(start - c.start) < 1e-9 && Math.abs(duration - c.duration) < 1e-9) return c;
          changed++;
          return { ...c, start, duration } as Clip;
        }),
  }));
  const next = { ...p, tracks };
  assertTracksValid(next, tracks.map((t) => t.id));
  return { project: next, changed };
}

/**
 * Abre um espaço de ${seconds} s em ${time}: clipes que atravessam o ponto são divididos (juntos, para manter as ligações),
 * e tudo o que começa a partir dele, em faixas desbloqueadas, e os marcadores andam para a frente.
 */
export function insertGap(p: Project, time: number, seconds: number): Project {
  if (!(seconds > 0) || !(time >= 0)) throw new TimelineError('Informe um instante e uma duração positivos', 'OUT_OF_RANGE');
  const min = minClipDuration(p);
  const crossing = p.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((c) => time > c.start + min - EPS && time < clipEnd(c) - min + EPS).map((c) => c.id)));
  let next = crossing.length ? splitClips(p, crossing, round6(time)).project : p;
  const touched = new Set<string>();
  for (const t of next.tracks) {
    if (t.locked || !t.clips.some((c) => c.start >= time - EPS)) continue;
    touched.add(t.id);
    next = withTrackClips(next, t.id, (cs) => cs.map((c) => (c.start >= time - EPS ? ({ ...c, start: round6(c.start + seconds) } as Clip) : c)));
  }
  assertTracksValid(next, touched);
  return { ...next, markers: next.markers.map((m) => (m.time >= time - EPS ? { ...m, time: round6(m.time + seconds) } : m)) };
}

/**
 * Remove o trecho [start, end] de todas as faixas desbloqueadas e fecha o vazio: clipes que atravessam as bordas são
 * divididos, os que ficam inteiros dentro do trecho são apagados e tudo o que vem depois (clipes e marcadores) volta ${end - start} s.
 * Falha se uma faixa bloqueada tiver clipe no trecho.
 */
export function cutRange(p: Project, start: number, end: number): Project {
  if (!(end > start) || start < 0) throw new TimelineError('O trecho precisa ter fim depois do início', 'OUT_OF_RANGE');
  const min = minClipDuration(p);
  const len = round6(end - start);
  const blocked = p.tracks.some((t) => t.locked && t.clips.some((c) => c.start < end - EPS && clipEnd(c) > start + EPS));
  if (blocked) throw new TimelineError('Há uma faixa bloqueada com clipes nesse trecho', 'LOCKED');
  let next = p;
  for (const at of [start, end]) {
    const ids = next.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((c) => at > c.start + min - EPS && at < clipEnd(c) - min + EPS).map((c) => c.id)));
    if (ids.length) next = splitClips(next, ids, round6(at)).project;
  }
  const inside = next.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((c) => c.start >= start - EPS && clipEnd(c) <= end + EPS).map((c) => c.id)));
  if (inside.length) next = deleteClips(next, inside, { ripple: false });
  const touched = new Set<string>();
  for (const t of next.tracks) {
    if (t.locked || !t.clips.some((c) => c.start >= end - EPS)) continue;
    touched.add(t.id);
    next = withTrackClips(next, t.id, (cs) => cs.map((c) => (c.start >= end - EPS ? ({ ...c, start: round6(c.start - len) } as Clip) : c)));
  }
  assertTracksValid(next, touched);
  return { ...next, markers: next.markers.filter((m) => m.time < start - EPS || m.time >= end - EPS).map((m) => (m.time >= end - EPS ? { ...m, time: round6(m.time - len) } : m)) };
}

/** Repete o clipe em sequência até cobrir exatamente até ${untilTime}; a última cópia é encurtada para parar ali. */
export function loopToFill(p: Project, clipId: string, untilTime: number): { project: Project; newIds: string[] } {
  const { clip } = requireClip(p, clipId);
  const missing = untilTime - clipEnd(clip);
  if (!(missing > 0.01)) throw new TimelineError('O instante precisa ficar depois do fim do clipe', 'OUT_OF_RANGE');
  const r = repeatClip(p, clipId, Math.ceil(missing / clip.duration - 1e-9));
  const lastId = r.newIds[r.newIds.length - 1]!;
  const last = findClip(r.project, lastId)!.clip;
  const project = clipEnd(last) - untilTime > 1e-6 ? trimClip(r.project, lastId, 'end', round6(untilTime)) : r.project;
  return { project, newIds: r.newIds };
}

/** Troca os instantes de início de dois clipes (podem estar em faixas diferentes). Falha se algum ficar sobreposto. */
export function swapClips(p: Project, aId: string, bId: string): Project {
  if (aId === bId) throw new TimelineError('Escolha dois clipes diferentes', 'OUT_OF_RANGE');
  const a = requireClip(p, aId);
  const b = requireClip(p, bId);
  assertUnlocked(a.track);
  assertUnlocked(b.track);
  const sa = a.clip.start;
  const sb = b.clip.start;
  let next = withTrackClips(p, a.track.id, (cs) => cs.map((c) => (c.id === aId ? ({ ...c, start: sb } as Clip) : c)));
  next = withTrackClips(next, b.track.id, (cs) => cs.map((c) => (c.id === bId ? ({ ...c, start: sa } as Clip) : c)));
  assertTracksValid(next, [a.track.id, b.track.id]);
  return next;
}
