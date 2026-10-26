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

/**
 * Interpreta um tempo digitado pelo usuário e devolve segundos (ou `null` se inválido).
 * Aceita: `90` e `1.5` (segundos), `1:30` (min:s), `1:02:03` (h:min:s), `00:00:01:15` (h:min:s:quadros),
 * `2m30s`, `1h5m`, `45s` e `12f` (quadros).
 */
export function parseTimecode(text: string, fps: number): number | null {
  const s = text.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let out: number | null = null;
  if (/^\d+(\.\d+)?$/.test(s)) out = Number(s);
  else if (/^\d+f$/.test(s)) out = Number(s.slice(0, -1)) / fps;
  else if (/^(\d+h)?(\d+m)?(\d+(\.\d+)?s)?$/.test(s) && /[hms]/.test(s)) {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(s)!;
    out = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } else if (/^\d+(:\d+){1,3}$/.test(s) || /^\d+:\d+:\d+(\.\d+)?$/.test(s) || /^\d+:\d+(\.\d+)?$/.test(s)) {
    const parts = s.split(':');
    const nums = parts.map(Number);
    if (parts.length === 4) {
      const [h, m, sec, f] = nums as [number, number, number, number];
      if (f >= Math.ceil(fps)) return null;
      out = h * 3600 + m * 60 + sec + f / fps;
    } else if (parts.length === 3) {
      out = nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
    } else {
      out = nums[0]! * 60 + nums[1]!;
    }
    if (parts.length >= 2 && nums.slice(1, 3).some((n) => n >= 60)) return null;
  }
  return out !== null && Number.isFinite(out) && out >= 0 ? round6(out) : null;
}
