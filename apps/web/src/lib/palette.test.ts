import { describe, expect, it } from 'vitest';
import { dominantColors } from './palette';

/** Imagem RGBA w×h; `paint(x, y)` devolve [r, g, b, a]. */
function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(paint(x, y), (y * w + x) * 4);
  return d;
}

describe('dominantColors', () => {
  it('imagem de uma cor só devolve essa cor', () => {
    expect(dominantColors(image(8, 8, () => [10, 200, 30, 255]))).toEqual(['#0ac81e']);
  });

  it('metade vermelha e metade azul: as duas aparecem', () => {
    const d = image(20, 20, (x) => (x < 10 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const out = dominantColors(d, 2);
    expect(out).toHaveLength(2);
    expect(out).toContain('#ff0000');
    expect(out).toContain('#0000ff');
  });

  it('a cor mais presente vem primeiro', () => {
    const d = image(20, 10, (x) => (x < 15 ? [0, 255, 0, 255] : [255, 255, 0, 255])); // 75% verde
    expect(dominantColors(d, 2)[0]).toBe('#00ff00');
  });

  it('ignora pixels transparentes', () => {
    const d = image(10, 10, (x) => (x < 8 ? [0, 0, 0, 0] : [255, 128, 0, 255]));
    expect(dominantColors(d, 3)).toEqual(['#ff8000']);
  });

  it('respeita o limite k e devolve vazio sem pixels úteis', () => {
    const d = image(16, 16, (x, y) => [x * 16, y * 16, (x + y) * 8, 255]);
    expect(dominantColors(d, 3).length).toBeLessThanOrEqual(3);
    expect(dominantColors(d, 0)).toEqual([]);
    expect(dominantColors(image(4, 4, () => [1, 2, 3, 0]))).toEqual([]);
  });

  it('degradê de preto a branco com 3 cores: uma escura, uma média e uma clara', () => {
    const d = image(30, 1, (x) => [x * 8, x * 8, x * 8, 255]);
    const lum = dominantColors(d, 3).map((c) => parseInt(c.slice(1, 3), 16)).sort((a, b) => a - b);
    expect(lum).toHaveLength(3);
    expect(lum[0]!).toBeLessThan(60);
    expect(lum[2]!).toBeGreaterThan(160);
  });
});
