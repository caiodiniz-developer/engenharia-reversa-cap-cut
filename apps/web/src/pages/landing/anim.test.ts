import { describe, expect, it } from 'vitest';
import { countAt, easeOutCubic } from './anim';

describe('animação numérica', () => {
  it('easeOutCubic vai de 0 a 1, cresce sempre e desacelera no fim', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = easeOutCubic(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // sai rápido
    expect(easeOutCubic(0.9) - easeOutCubic(0.8)).toBeLessThan(easeOutCubic(0.2) - easeOutCubic(0.1)); // chega devagar
  });

  it('fora do intervalo 0–1 o progresso é limitado', () => {
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(7)).toBe(1);
  });

  it('countAt interpola inteiros entre dois valores, para cima e para baixo', () => {
    expect(countAt(0, 100, 0)).toBe(0);
    expect(countAt(0, 100, 1)).toBe(100);
    expect(Number.isInteger(countAt(0, 7, 0.37))).toBe(true);
    expect(countAt(80, 100, 0.5)).toBeGreaterThan(90);
    expect(countAt(100, 60, 1)).toBe(60);
    expect(countAt(100, 60, 0.5)).toBeLessThan(100);
    expect(countAt(100, 60, 0.5)).toBeGreaterThan(60);
  });
});
