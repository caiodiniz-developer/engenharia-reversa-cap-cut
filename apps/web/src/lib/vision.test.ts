import { describe, expect, it } from 'vitest';
import { colorMatrixValues, simulateVision, VISION_MATRIX, VISION_MODES } from './vision';

describe('simulação de daltonismo', () => {
  it('cada linha das matrizes soma 1: cinzas e branco continuam iguais', () => {
    for (const [mode, m] of Object.entries(VISION_MATRIX)) for (const row of m) expect(row.reduce((a, b) => a + b, 0), mode).toBeCloseTo(1, 4);
    for (const mode of VISION_MODES) {
      const [r, g, b] = simulateVision([0.5, 0.5, 0.5], mode);
      expect([r, g, b].every((v) => Math.abs(v - 0.5) < 1e-4), mode).toBe(true);
    }
  });

  it('modo normal devolve a mesma cor', () => {
    expect(simulateVision([0.2, 0.4, 0.6], 'normal')).toEqual([0.2, 0.4, 0.6]);
  });

  it('protanopia e deuteranopia aproximam vermelho e verde (a distância entre eles cai mais de 15%)', () => {
    const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    const red: [number, number, number] = [1, 0, 0];
    const green: [number, number, number] = [0, 1, 0];
    const normal = dist(red, green);
    for (const mode of ['protanopia', 'deuteranopia'] as const) {
      expect(dist(simulateVision(red, mode), simulateVision(green, mode)), mode).toBeLessThan(normal * 0.85);
    }
  });

  it('acromatopsia deixa só a luminância: três canais iguais', () => {
    const [r, g, b] = simulateVision([1, 0.2, 0.1], 'achromatopsia');
    expect(r).toBeCloseTo(g, 6);
    expect(g).toBeCloseTo(b, 6);
  });

  it('os valores da feColorMatrix têm 20 números e a última linha mantém o alfa', () => {
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const) {
      const v = colorMatrixValues(mode).split(' ').map(Number);
      expect(v).toHaveLength(20);
      expect(v.slice(15)).toEqual([0, 0, 0, 1, 0]);
    }
  });
});
