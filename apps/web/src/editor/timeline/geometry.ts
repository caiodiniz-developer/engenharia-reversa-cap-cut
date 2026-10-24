import type { TrackKind } from '@editor/core';

export const HEADER_W = 176;
export const RULER_H = 28;

export const trackHeight = (kind: TrackKind): number => (kind === 'video' ? 56 : kind === 'audio' ? 48 : 36);

/** Escolhe o passo (s) das marcações da régua conforme o zoom, para ~80px entre marcações principais. */
export function rulerStep(pps: number): { major: number; minor: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const major = steps.find((s) => s * pps >= 80) ?? 600;
  return { major, minor: major / (major === 1 || major === 10 || major === 60 ? 5 : major === 0.5 || major === 5 ? 5 : 4) };
}

export function formatRuler(t: number, major: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  if (major >= 1) return `${m}:${String(Math.round(s)).padStart(2, '0')}`;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
