import { round6, type MediaClip, type Range } from '@editor/core';

/** Janela da mídia de origem usada pelo clipe, em segundos. */
export function sourceWindow(clip: MediaClip): Range {
  return { start: clip.sourceIn, end: clip.sourceIn + clip.duration * clip.speed };
}

/** Converte um instante da mídia de origem para o tempo da timeline segundo o clipe (velocidade e reverso). */
export function sourceToTimeline(clip: MediaClip, t: number): number {
  const w = sourceWindow(clip);
  const rel = clip.reverse ? w.end - t : t - w.start;
  return round6(clip.start + rel / clip.speed);
}

/**
 * Converte um trecho da mídia (ex.: silêncio detectado, palavra transcrita) para a timeline,
 * recortado à janela usada pelo clipe. Devolve null se o trecho não cabe no clipe.
 */
export function rangeToTimeline(clip: MediaClip, r: Range): Range | null {
  if (clip.freeze) return null;
  const w = sourceWindow(clip);
  const a = Math.max(r.start, w.start);
  const b = Math.min(r.end, w.end);
  if (b - a <= 1e-6) return null;
  const t1 = sourceToTimeline(clip, a);
  const t2 = sourceToTimeline(clip, b);
  return { start: Math.min(t1, t2), end: Math.max(t1, t2) };
}
