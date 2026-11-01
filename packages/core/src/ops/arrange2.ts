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

function mulberry32(seed: number): () => number {
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
