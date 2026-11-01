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
