import { projectDuration } from './project';
import type { Project } from './schema';

export interface PacingStats {
  /** Quantidade de planos (clipes visuais em faixas de vídeo visíveis). */
  shots: number;
  /** Duração média e mediana dos planos, em segundos. */
  average: number;
  median: number;
  shortest: number;
  longest: number;
  /** Cortes por minuto de projeto (planos − 1 dividido pela duração). */
  cutsPerMinute: number;
  /** Contagem de planos por faixa de duração: < 1 s, 1–2 s, 2–4 s, 4–8 s, ≥ 8 s. */
  histogram: number[];
}

export const HISTOGRAM_LABELS = ['< 1 s', '1–2 s', '2–4 s', '4–8 s', '≥ 8 s'];
const EDGES = [1, 2, 4, 8];

/** Estatísticas de ritmo de edição a partir da duração dos planos visuais. Devolve `null` sem planos. */
export function pacingStats(p: Project): PacingStats | null {
  const lengths: number[] = [];
  for (const t of p.tracks) {
    if (t.kind !== 'video' || t.hidden) continue;
    for (const c of t.clips) if (c.type === 'media' && p.media[c.mediaId]?.kind !== 'audio') lengths.push(c.duration);
  }
  if (!lengths.length) return null;
  const sorted = [...lengths].sort((a, b) => a - b);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const histogram = new Array(EDGES.length + 1).fill(0) as number[];
  for (const l of lengths) {
    const bin = EDGES.findIndex((e) => l < e);
    histogram[bin === -1 ? EDGES.length : bin]!++;
  }
  const total = projectDuration(p);
  return {
    shots: lengths.length,
    average: round2(sum / lengths.length),
    median: round2(median),
    shortest: round2(sorted[0]!),
    longest: round2(sorted[sorted.length - 1]!),
    cutsPerMinute: total > 0 ? round2(((lengths.length - 1) / total) * 60) : 0,
    histogram,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Descrição do ritmo pela duração média dos planos. */
export function pacingLabel(average: number): string {
  if (average < 1.5) return 'Frenético';
  if (average < 3) return 'Dinâmico';
  if (average < 6) return 'Moderado';
  return 'Contemplativo';
}

/**
 * Curva do ritmo ao longo do projeto: quantos cortes (início de plano) caem em cada janela de `windowSec` segundos.
 * Serve para desenhar o "mapa de ritmo" e achar trechos parados.
 */
export function pacingCurve(p: Project, windowSec = 5): number[] {
  const total = projectDuration(p);
  if (total <= 0 || windowSec <= 0) return [];
  const bins = new Array(Math.ceil(total / windowSec)).fill(0) as number[];
  for (const t of p.tracks) {
    if (t.kind !== 'video' || t.hidden) continue;
    for (const c of t.clips) {
      if (c.type !== 'media' || p.media[c.mediaId]?.kind === 'audio' || c.start <= 0) continue;
      const i = Math.min(bins.length - 1, Math.floor(c.start / windowSec));
      bins[i]!++;
    }
  }
  return bins;
}

/** Janelas sem nenhum corte por pelo menos `minWindows` seguidas: trechos "parados" (início, fim em segundos). */
export function stillStretches(p: Project, windowSec = 5, minWindows = 3): Array<{ start: number; end: number }> {
  const curve = pacingCurve(p, windowSec);
  const total = projectDuration(p);
  const out: Array<{ start: number; end: number }> = [];
  let run = 0;
  for (let i = 0; i <= curve.length; i++) {
    if (i < curve.length && curve[i] === 0) run++;
    else {
      if (run >= minWindows) out.push({ start: (i - run) * windowSec, end: Math.min(total, i * windowSec) });
      run = 0;
    }
  }
  return out;
}
