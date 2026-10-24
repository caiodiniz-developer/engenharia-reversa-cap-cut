import type { Range } from '@editor/core';

export interface Highlight {
  start: number;
  end: number;
  /** 0..1, maior = mais provável de ser um bom trecho (heurística, não garantia). */
  score: number;
  reason: string;
}

/**
 * Seleção heurística de trechos: junta regiões com fala/áudio (fora dos silêncios), pontua por energia
 * média e proximidade de trocas de cena e escolhe os melhores até a duração-alvo, em ordem cronológica.
 * É uma sugestão baseada em sinais de áudio/vídeo; a decisão final é do usuário.
 */
export function pickHighlights(opts: {
  duration: number;
  silences: Range[];
  /** Energia normalizada (0..1) por janela de `windowSec`. */
  energy: ArrayLike<number>;
  windowSec: number;
  scenes: number[];
  targetSeconds: number;
  minSegment?: number;
  maxSegment?: number;
}): Highlight[] {
  const minSeg = opts.minSegment ?? 2;
  const maxSeg = opts.maxSegment ?? 12;
  const voiced: Range[] = [];
  let cursor = 0;
  for (const s of [...opts.silences].sort((a, b) => a.start - b.start)) {
    if (s.start > cursor) voiced.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < opts.duration) voiced.push({ start: cursor, end: opts.duration });

  const candidates: Highlight[] = [];
  for (const r of voiced) {
    for (let s = r.start; s < r.end - 1e-6; s += maxSeg) {
      const e = Math.min(r.end, s + maxSeg);
      if (e - s < minSeg) continue;
      const i0 = Math.floor(s / opts.windowSec);
      const i1 = Math.max(i0 + 1, Math.ceil(e / opts.windowSec));
      let sum = 0;
      for (let i = i0; i < i1 && i < opts.energy.length; i++) sum += opts.energy[i]!;
      const meanEnergy = sum / Math.max(1, Math.min(i1, opts.energy.length) - i0);
      const nearScene = opts.scenes.some((t) => t >= s - 0.5 && t <= s + 0.5);
      const score = Math.min(1, meanEnergy * 0.8 + (nearScene ? 0.2 : 0));
      candidates.push({ start: s, end: e, score, reason: nearScene ? 'início coincide com troca de cena; áudio ativo' : 'trecho com áudio ativo' });
    }
  }

  const chosen: Highlight[] = [];
  let total = 0;
  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    if (total >= opts.targetSeconds) break;
    const len = c.end - c.start;
    if (total + len > opts.targetSeconds + 1) {
      const trimmed = opts.targetSeconds - total;
      if (trimmed < minSeg) continue;
      chosen.push({ ...c, end: c.start + trimmed });
      total += trimmed;
    } else {
      chosen.push(c);
      total += len;
    }
  }
  return chosen.sort((a, b) => a.start - b.start);
}
