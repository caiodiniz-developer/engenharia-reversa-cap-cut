import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHexColor, relativeLuminance } from './color';

describe('parseHexColor', () => {
  it('aceita #rgb, #rrggbb e #rrggbbaa (ignorando o alfa), sem diferenciar maiúsculas', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#3B82F6')).toEqual([59, 130, 246]);
    expect(parseHexColor('#000000cc')).toEqual([0, 0, 0]);
  });

  it('recusa formatos inválidos', () => {
    for (const bad of ['', 'red', '#12', '#12345', '#gggggg', '123456']) expect(parseHexColor(bad), bad).toBeNull();
  });
});

describe('contraste (WCAG)', () => {
  it('preto sobre branco = 21 e igual é 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });

  it('valores conhecidos: cinza #777 sobre branco ≈ 4,48; amarelo sobre branco é baixo', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#ffff00', '#ffffff')!).toBeLessThan(1.5);
  });

  it('luminância cresce do preto ao branco e cor inválida devolve null', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
    expect(relativeLuminance([128, 128, 128])).toBeGreaterThan(0.2);
    expect(contrastRatio('x', '#fff')).toBeNull();
  });
});
