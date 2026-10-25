import type { Project } from './schema';
import { clipEnd } from './time';

/** Instantes de corte: início/fim de cada clipe e marcadores, ordenados e sem repetição. */
export function editPoints(p: Project, opts: { markers?: boolean } = {}): number[] {
  const times = new Set<number>([0]);
  for (const t of p.tracks) {
    for (const c of t.clips) {
      times.add(Math.round(c.start * 1e6) / 1e6);
      times.add(Math.round(clipEnd(c) * 1e6) / 1e6);
    }
  }
  if (opts.markers) for (const m of p.markers) times.add(Math.round(m.time * 1e6) / 1e6);
  return [...times].sort((a, b) => a - b);
}

/**
 * Próximo (dir = 1) ou anterior (dir = -1) ponto de corte em relação a `time`.
 * Devolve `undefined` se não houver mais nenhum nessa direção. A tolerância evita "grudar" no ponto em que já estamos.
 */
export function neighborEdit(p: Project, time: number, dir: 1 | -1, opts: { markers?: boolean; epsilon?: number } = {}): number | undefined {
  const eps = opts.epsilon ?? 1e-4;
  const pts = editPoints(p, opts);
  return dir === 1 ? pts.find((t) => t > time + eps) : [...pts].reverse().find((t) => t < time - eps);
}
