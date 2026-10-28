import type { VisionMode } from '../store/editor';

export const VISION_MODES: VisionMode[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

export const VISION_LABEL: Record<VisionMode, string> = {
  normal: 'Visão normal',
  protanopia: 'Protanopia (sem vermelho)',
  deuteranopia: 'Deuteranopia (sem verde)',
  tritanopia: 'Tritanopia (sem azul)',
  achromatopsia: 'Acromatopsia (tons de cinza)',
};

/**
 * Matrizes 3×3 (linhas R', G', B') que simulam cada tipo de daltonismo sobre cores RGB lineares de 0 a 1
 * (Machado, Oliveira e Fernandes, 2009, severidade total). A acromatopsia usa a luminância Rec. 709.
 */
export const VISION_MATRIX: Record<Exclude<VisionMode, 'normal'>, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
  achromatopsia: [
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
  ],
};

/** Valores da `feColorMatrix` (4×5) correspondentes à matriz do modo. */
export function colorMatrixValues(mode: Exclude<VisionMode, 'normal'>): string {
  return VISION_MATRIX[mode].map(([a, b, c]) => `${a} ${b} ${c} 0 0`).concat('0 0 0 1 0').join(' ');
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Aplica a simulação a uma cor RGB (0–255) já em espaço linear de 0–1; devolve 0–1. Útil para testar e para amostras. */
export function simulateVision(rgb: [number, number, number], mode: VisionMode): [number, number, number] {
  if (mode === 'normal') return rgb;
  const m = VISION_MATRIX[mode];
  const out = m.map((row) => clamp01(row[0]! * rgb[0] + row[1]! * rgb[1] + row[2]! * rgb[2]));
  return [out[0]!, out[1]!, out[2]!];
}
