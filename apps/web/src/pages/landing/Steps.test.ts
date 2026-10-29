import { describe, expect, it } from 'vitest';
import { reachedStep } from './Steps';

describe('passos que acendem com a rolagem', () => {
  it('nenhum passo no começo e todos no fim', () => {
    expect(reachedStep(0, 3)).toBe(-1);
    expect(reachedStep(1, 3)).toBe(2);
  });

  it('cada passo acende em (i + 0,35) ÷ total', () => {
    expect(reachedStep(0.11, 3)).toBe(-1);
    expect(reachedStep(0.12, 3)).toBe(0);
    expect(reachedStep(0.44, 3)).toBe(0);
    expect(reachedStep(0.46, 3)).toBe(1);
    expect(reachedStep(0.77, 3)).toBe(1);
    expect(reachedStep(0.79, 3)).toBe(2);
  });

  it('só avança com o progresso e limita valores fora de 0–1', () => {
    let prev = -2;
    for (let i = 0; i <= 100; i++) {
      const r = reachedStep(i / 100, 3);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(reachedStep(-5, 3)).toBe(-1);
    expect(reachedStep(9, 3)).toBe(2);
    expect(reachedStep(0.5, 0)).toBe(-1);
  });
});
