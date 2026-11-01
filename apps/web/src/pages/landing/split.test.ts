import { describe, expect, it } from 'vitest';
import { splitWords, staggerDelay } from './split';

describe('splitWords', () => {
  it('ignora espaços repetidos e nas pontas', () => {
    expect(splitWords('  Edite,   revise  e exporte ')).toEqual(['Edite,', 'revise', 'e', 'exporte']);
    expect(splitWords('   ')).toEqual([]);
  });
});

describe('staggerDelay', () => {
  it('cresce de passo em passo e para no limite', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(0.06);
    expect(staggerDelay(5)).toBeCloseTo(0.3, 6);
    expect(staggerDelay(10)).toBe(0.6);
    expect(staggerDelay(500)).toBe(0.6);
  });

  it('aceita passo e limite próprios e trata índice negativo como zero', () => {
    expect(staggerDelay(3, 0.1, 1)).toBeCloseTo(0.3, 6);
    expect(staggerDelay(30, 0.1, 1)).toBe(1);
    expect(staggerDelay(-4)).toBe(0);
  });
});
