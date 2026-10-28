/** Extração das cores dominantes de uma imagem (corte mediano), para sugerir cores de texto que combinam com o quadro. */

type Px = [number, number, number];

const hex = (c: Px) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function average(px: Px[]): Px {
  const n = px.length || 1;
  return [px.reduce((a, p) => a + p[0], 0) / n, px.reduce((a, p) => a + p[1], 0) / n, px.reduce((a, p) => a + p[2], 0) / n];
}

function widestChannel(px: Px[]): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  let range = -1;
  for (const ch of [0, 1, 2] as const) {
    let lo = 255;
    let hi = 0;
    for (const p of px) {
      lo = Math.min(lo, p[ch]);
      hi = Math.max(hi, p[ch]);
    }
    if (hi - lo > range) {
      range = hi - lo;
      best = ch;
    }
  }
  return best;
}

/**
 * Devolve até `k` cores (#rrggbb) em ordem de presença no quadro. Ignora pixels quase transparentes e
 * usa no máximo ~`sample` pixels (amostragem uniforme) para ser rápido mesmo em imagens grandes.
 * `data` é o RGBA de um ImageData.
 */
export function dominantColors(data: ArrayLike<number>, k = 5, sample = 4096): string[] {
  const total = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(total / sample));
  const pixels: Px[] = [];
  for (let i = 0; i < total; i += step) {
    if (data[i * 4 + 3]! < 128) continue;
    pixels.push([data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!]);
  }
  if (!pixels.length || k < 1) return [];
  let boxes: Px[][] = [pixels];
  while (boxes.length < k) {
    // divide a caixa mais populosa que ainda tem variação, ao meio do canal de maior amplitude
    boxes.sort((a, b) => b.length - a.length);
    const idx = boxes.findIndex((b) => b.length > 1 && (() => {
      const ch = widestChannel(b);
      return Math.max(...b.map((p) => p[ch])) > Math.min(...b.map((p) => p[ch]));
    })());
    if (idx === -1) break;
    const box = boxes[idx]!;
    const ch = widestChannel(box);
    const sorted = [...box].sort((a, b) => a[ch] - b[ch]);
    const mid = sorted.length >> 1;
    boxes = [...boxes.slice(0, idx), sorted.slice(0, mid), sorted.slice(mid), ...boxes.slice(idx + 1)];
  }
  const out = boxes.sort((a, b) => b.length - a.length).map((b) => hex(average(b)));
  return [...new Set(out)];
}
