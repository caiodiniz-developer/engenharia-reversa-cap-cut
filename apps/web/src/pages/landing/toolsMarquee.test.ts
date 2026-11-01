import { describe, expect, it } from 'vitest';
import { TOOLS_MARQUEE } from './content';

describe('ferramentas da segunda faixa', () => {
  it('nomes únicos, curtos e preenchidos', () => {
    expect(new Set(TOOLS_MARQUEE).size).toBe(TOOLS_MARQUEE.length);
    expect(TOOLS_MARQUEE.every((n) => n.trim() === n && n.length >= 5 && n.length <= 32)).toBe(true);
  });

  it('tem itens suficientes para a faixa dar a volta sem buracos', () => {
    expect(TOOLS_MARQUEE.length).toBeGreaterThanOrEqual(16);
  });
});
