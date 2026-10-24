/** Utilitários puros para análise de mídia (silêncio, ritmo, cenas) usados pelas ferramentas de IA/áudio. */

export interface Range {
  start: number;
  end: number;
}

/**
 * Detecta silêncios a partir de amostras de pico/RMS normalizadas (0..1) em janelas de `windowSec`.
 * Só devolve trechos com pelo menos `minDuration` segundos abaixo do limiar.
 */
export function detectSilence(
  levels: ArrayLike<number>,
  windowSec: number,
  opts: { threshold?: number; minDuration?: number } = {},
): Range[] {
  const threshold = opts.threshold ?? 0.02;
  const minDuration = opts.minDuration ?? 0.5;
  const out: Range[] = [];
  let startIdx = -1;
  for (let i = 0; i <= levels.length; i++) {
    const quiet = i < levels.length && levels[i]! < threshold;
    if (quiet && startIdx === -1) startIdx = i;
    if (!quiet && startIdx !== -1) {
      const r = { start: startIdx * windowSec, end: i * windowSec };
      if (r.end - r.start >= minDuration) out.push(r);
      startIdx = -1;
    }
  }
  return out;
}

/** Reduz um buffer de amostras a `buckets` picos (0..1) para desenhar a forma de onda. */
export function peaks(samples: ArrayLike<number>, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const size = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    let max = 0;
    const from = Math.floor(b * size);
    const to = Math.min(samples.length, Math.max(from + 1, Math.floor((b + 1) * size)));
    for (let i = from; i < to; i++) max = Math.max(max, Math.abs(samples[i]!));
    out[b] = max;
  }
  return out;
}

/** Detecta batidas (picos de energia locais) para sugerir pontos de corte por ritmo. */
export function detectBeats(energy: ArrayLike<number>, windowSec: number, opts: { sensitivity?: number; minGap?: number } = {}): number[] {
  const sensitivity = opts.sensitivity ?? 1.4;
  const minGap = opts.minGap ?? 0.25;
  const beats: number[] = [];
  const lookback = Math.max(4, Math.round(1 / windowSec));
  for (let i = 1; i < energy.length - 1; i++) {
    let avg = 0;
    let n = 0;
    for (let k = Math.max(0, i - lookback); k < i; k++, n++) avg += energy[k]!;
    avg = n ? avg / n : 0;
    const isPeak = energy[i]! > energy[i - 1]! && energy[i]! >= energy[i + 1]!;
    if (isPeak && energy[i]! > avg * sensitivity && energy[i]! > 0.05) {
      const t = i * windowSec;
      if (!beats.length || t - beats[beats.length - 1]! >= minGap) beats.push(t);
    }
  }
  return beats;
}

/** Inverte silêncios em trechos "com fala" dentro de [0, total]. */
export function invertRanges(ranges: Range[], total: number): Range[] {
  const out: Range[] = [];
  let cursor = 0;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    if (r.start > cursor) out.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < total) out.push({ start: cursor, end: total });
  return out;
}
