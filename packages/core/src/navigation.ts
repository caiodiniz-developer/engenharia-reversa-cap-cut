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

/** Clipes que começam em `time` ou depois (side = 'after') ou que terminam em `time` ou antes (side = 'before'). Ignora faixas bloqueadas. */
export function clipIdsBySide(p: Project, time: number, side: 'after' | 'before'): string[] {
  const eps = 1e-6;
  const ids: string[] = [];
  for (const t of p.tracks) {
    if (t.locked) continue;
    for (const c of t.clips) {
      if (side === 'after' ? c.start >= time - eps : clipEnd(c) <= time + eps) ids.push(c.id);
    }
  }
  return ids;
}

/** Clipes que contêm o instante `time` (estritamente dentro). Ignora faixas bloqueadas. */
export function clipIdsAt(p: Project, time: number): string[] {
  const eps = 1e-6;
  return p.tracks.filter((t) => !t.locked).flatMap((t) => t.clips.filter((c) => time > c.start + eps && time < clipEnd(c) - eps).map((c) => c.id));
}

/** Área de trabalho: intervalo [start, end] da timeline usado para exportar só um trecho. */
export interface WorkArea {
  start: number;
  end: number;
}

const MIN_WORK_AREA = 0.1;

/**
 * Define a borda inicial ("in") ou final ("out") da área de trabalho no instante `time`.
 * Sem área prévia, a outra borda assume o começo/fim do projeto. Se a borda nova ultrapassa a
 * outra, a outra volta ao limite do projeto. Devolve `null` quando o resultado seria vazio.
 */
export function setWorkAreaEdge(area: WorkArea | null, edge: 'start' | 'end', time: number, total: number): WorkArea | null {
  if (total <= 0) return null;
  const t = Math.min(Math.max(time, 0), total);
  let start = area?.start ?? 0;
  let end = area?.end ?? total;
  if (edge === 'start') {
    start = t;
    if (end - start < MIN_WORK_AREA) end = total;
  } else {
    end = t;
    if (end - start < MIN_WORK_AREA) start = 0;
  }
  start = Math.round(start * 1e6) / 1e6;
  end = Math.round(end * 1e6) / 1e6;
  return end - start >= MIN_WORK_AREA ? { start, end } : null;
}

/** Ajusta a área ao tamanho atual do projeto (ex.: depois de encurtar a timeline). */
export function clampWorkArea(area: WorkArea | null, total: number): WorkArea | null {
  if (!area) return null;
  const end = Math.min(area.end, total);
  return end - area.start >= MIN_WORK_AREA ? { start: area.start, end } : null;
}
