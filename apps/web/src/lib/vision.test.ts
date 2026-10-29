import { describe, expect, it } from 'vitest';
import { colorMatrixValues, simulateHex, simulateVision, VISION_MATRIX, VISION_MODES } from './vision';

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

describe('simulateHex', () => {
  it('modo normal e cores inválidas voltam como entraram', () => {
    expect(simulateHex('#3b82f6', 'normal')).toBe('#3b82f6');
    expect(simulateHex('azul', 'protanopia')).toBe('azul');
  });

  it('cinzas continuam cinzas em todos os modos (a conversão linear não desvia)', () => {
    for (const mode of VISION_MODES) {
      const out = simulateHex('#808080', mode);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
      expect(Math.abs(r! - 128), mode).toBeLessThanOrEqual(2);
      expect(Math.abs(g! - 128), mode).toBeLessThanOrEqual(2);
      expect(Math.abs(b! - 128), mode).toBeLessThanOrEqual(2);
    }
  });

  it('vermelho puro perde força em protanopia e acromatopsia deixa os três canais iguais', () => {
    const prot = simulateHex('#ff0000', 'protanopia');
    expect(parseInt(prot.slice(1, 3), 16)).toBeLessThan(150);
    const gray = simulateHex('#ff3300', 'achromatopsia');
    expect(gray.slice(1, 3)).toBe(gray.slice(3, 5));
    expect(gray.slice(3, 5)).toBe(gray.slice(5, 7));
  });

  it('vermelho e verde ficam mais parecidos em deuteranopia do que eram', () => {
    const d = (a: string, b: string) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
    expect(d(simulateHex('#e11d48', 'deuteranopia'), simulateHex('#16a34a', 'deuteranopia'))).toBeLessThan(d('#e11d48', '#16a34a'));
  });
});
