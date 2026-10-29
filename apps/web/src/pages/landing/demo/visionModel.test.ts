import { describe, expect, it } from 'vitest';
import { colorDistance, confusedPairs, CONFUSION_THRESHOLD, SWATCHES } from './visionModel';

describe('demonstração de daltonismo', () => {
  it('colorDistance: zero para cores iguais e máximo entre preto e branco', () => {
    expect(colorDistance('#336699', '#336699')).toBe(0);
    expect(colorDistance('#000000', '#ffffff')).toBe(442); // √(3·255²) ≈ 441,7
  });

  it('visão normal não confunde nenhum par da paleta', () => {
    expect(confusedPairs('normal')).toEqual([]);
  });

  const has = (mode: Parameters<typeof confusedPairs>[0], a: string, b: string) => confusedPairs(mode).some((p) => [p.a, p.b].sort().join('|') === [a, b].sort().join('|'));

  it('deuteranopia confunde Erro × Sucesso; protanopia confunde Info × Destaque (azul × roxo)', () => {
    expect(has('deuteranopia', 'Erro', 'Sucesso')).toBe(true);
    expect(has('protanopia', 'Info', 'Destaque')).toBe(true);
    // medido: para estas cores específicas, Erro × Sucesso ainda se distingue em protanopia (distância 90 > limiar)
    expect(has('protanopia', 'Erro', 'Sucesso')).toBe(false);
  });

  it('tritanopia confunde Sucesso × Info e a acromatopsia confunde várias cores com o mesmo brilho', () => {
    expect(has('tritanopia', 'Sucesso', 'Info')).toBe(true);
    expect(confusedPairs('achromatopsia').length).toBeGreaterThanOrEqual(5);
  });

  it('todo par devolvido está abaixo do limiar', () => {
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const) for (const p of confusedPairs(mode)) expect(p.distance, mode).toBeLessThan(CONFUSION_THRESHOLD);
  });

  it('os pares aparecem do mais confuso ao menos confuso e a paleta tem nomes únicos', () => {
    const d = confusedPairs('deuteranopia').map((p) => p.distance);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(new Set(SWATCHES.map((s) => s.name)).size).toBe(SWATCHES.length);
  });
});
