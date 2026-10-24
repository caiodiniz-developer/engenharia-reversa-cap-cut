import type { Project } from './schema';
import { clipEnd } from './time';

export interface SnapPoint {
  time: number;
  kind: 'clip-start' | 'clip-end' | 'playhead' | 'marker' | 'zero';
}

/** Pontos magnéticos: bordas de clipes (exceto os ignorados), marcadores, cabeça de reprodução e zero. */
export function collectSnapPoints(p: Project, opts: { exclude?: Set<string>; playhead?: number } = {}): SnapPoint[] {
  const pts: SnapPoint[] = [{ time: 0, kind: 'zero' }];
  if (opts.playhead !== undefined) pts.push({ time: opts.playhead, kind: 'playhead' });
  for (const m of p.markers) pts.push({ time: m.time, kind: 'marker' });
  for (const t of p.tracks)
    for (const c of t.clips) {
      if (opts.exclude?.has(c.id)) continue;
      pts.push({ time: c.start, kind: 'clip-start' }, { time: clipEnd(c), kind: 'clip-end' });
    }
  return pts;
}

/**
 * Encaixa o intervalo [start, start+length] nos pontos próximos. Testa a borda inicial e a final
 * e devolve o menor ajuste dentro do limiar (em segundos).
 */
export function snapRange(
  start: number,
  length: number,
  points: SnapPoint[],
  threshold: number,
): { start: number; snappedTo?: SnapPoint } {
  let best: { delta: number; point: SnapPoint } | undefined;
  for (const pt of points) {
    for (const edge of [start, start + length]) {
      const delta = pt.time - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, point: pt };
    }
  }
  return best ? { start: start + best.delta, snappedTo: best.point } : { start };
}

export function snapTime(time: number, points: SnapPoint[], threshold: number): { time: number; snappedTo?: SnapPoint } {
  const r = snapRange(time, 0, points, threshold);
  return { time: r.start, snappedTo: r.snappedTo };
}
