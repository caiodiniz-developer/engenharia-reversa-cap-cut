import { simulateHex } from '../../../lib/vision';
import type { VisionMode } from '../../../store/editor';

export interface Swatch {
  name: string;
  hex: string;
}

/** Cores de um painel típico (gráfico, status, destaques). Vermelho × verde é o par clássico que confunde. */
export const SWATCHES: Swatch[] = [
  { name: 'Erro', hex: '#e11d48' },
  { name: 'Sucesso', hex: '#16a34a' },
  { name: 'Alerta', hex: '#f59e0b' },
  { name: 'Info', hex: '#2563eb' },
  { name: 'Destaque', hex: '#9333ea' },
  { name: 'Neutro', hex: '#64748b' },
];

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** Distância euclidiana entre duas cores #rrggbb (0 a ~441). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.round(Math.hypot(r1 - r2, g1 - g2, b1 - b2));
}

/** Abaixo disso, duas cores deixam de ser fáceis de distinguir lado a lado (limiar prático, não normativo). */
export const CONFUSION_THRESHOLD = 70;

export interface Confusion {
  a: string;
  b: string;
  distance: number;
}

/** Pares de cores que ficam difíceis de distinguir no modo escolhido (e não eram no modo normal). */
export function confusedPairs(mode: VisionMode, swatches: Swatch[] = SWATCHES): Confusion[] {
  const out: Confusion[] = [];
  for (let i = 0; i < swatches.length; i++) {
    for (let j = i + 1; j < swatches.length; j++) {
      const a = swatches[i]!;
      const b = swatches[j]!;
      const before = colorDistance(a.hex, b.hex);
      const after = colorDistance(simulateHex(a.hex, mode), simulateHex(b.hex, mode));
      if (before >= CONFUSION_THRESHOLD && after < CONFUSION_THRESHOLD) out.push({ a: a.name, b: b.name, distance: after });
    }
  }
  return out.sort((x, y) => x.distance - y.distance);
}
