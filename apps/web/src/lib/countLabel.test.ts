import { describe, expect, it } from 'vitest';
import { countLabel } from './format';

describe('countLabel', () => {
  it('singular e plural sem filtro', () => {
    expect(countLabel(1, 1, 'projeto', 'projetos')).toBe('1 projeto');
    expect(countLabel(3, 3, 'projeto', 'projetos')).toBe('3 projetos');
    expect(countLabel(0, 0, 'projeto', 'projetos')).toBe('0 projetos');
  });

  it('com filtro mostra "x de y" e o substantivo concorda com o total', () => {
    expect(countLabel(2, 5, 'projeto', 'projetos')).toBe('2 de 5 projetos');
    expect(countLabel(0, 5, 'projeto', 'projetos')).toBe('0 de 5 projetos');
    expect(countLabel(0, 1, 'projeto', 'projetos')).toBe('0 de 1 projeto');
  });
});
