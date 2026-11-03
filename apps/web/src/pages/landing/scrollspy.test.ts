import { describe, expect, it } from 'vitest';
import { activeSectionId } from './scroll';

const tops = (...t: number[]) => ['recursos', 'diferenciais', 'experimente', 'como-funciona', 'perguntas'].map((id, i) => ({ id, top: t[i]! }));

describe('activeSectionId', () => {
  it('antes da primeira seção chegar perto do topo, nenhuma está ativa', () => {
    expect(activeSectionId(tops(900, 1700, 2500, 3300, 4100), 120)).toBeNull();
  });

  it('a seção ativa é a última cujo topo já passou do limite', () => {
    expect(activeSectionId(tops(100, 900, 1700, 2500, 3300), 120)).toBe('recursos');
    expect(activeSectionId(tops(-700, 100, 900, 1700, 2500), 120)).toBe('diferenciais');
    expect(activeSectionId(tops(-3000, -2200, -1400, -600, 80), 120)).toBe('perguntas');
  });

  it('o limite exato conta como já alcançado e a lista vazia não tem seção', () => {
    expect(activeSectionId(tops(120, 900, 1700, 2500, 3300), 120)).toBe('recursos');
    expect(activeSectionId(tops(121, 900, 1700, 2500, 3300), 120)).toBeNull();
    expect(activeSectionId([], 120)).toBeNull();
  });
});
