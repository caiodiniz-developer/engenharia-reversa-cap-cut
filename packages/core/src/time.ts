import type { Clip } from './schema';

export const EPS = 1e-6;

/** Arredonda a 6 casas para evitar acúmulo de erro de ponto flutuante. */
export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export const snapToFrame = (t: number, fps: number): number => round6(Math.round(t * fps) / fps);

export const toFrame = (t: number, fps: number): number => Math.round(t * fps);

export const fromFrame = (f: number, fps: number): number => round6(f / fps);

export const clipEnd = (c: Pick<Clip, 'start' | 'duration'>): number => round6(c.start + c.duration);

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Formata segundos como HH:MM:SS:FF. */
export function formatTimecode(t: number, fps: number): string {
  const total = Math.max(0, t);
  const frames = Math.floor(round6(total * fps)) % Math.round(fps);
  const s = Math.floor(total);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(frames)}`;
}
