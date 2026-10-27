import { describe, expect, it } from 'vitest';
import { coverScale, positionFor, POSITION_PRESETS, shownFraction } from './layout';

const frame = { width: 1920, height: 1080 };

describe('shownFraction', () => {
  it('mídia 16:9 em quadro 16:9 ocupa tudo na escala 1 e metade na escala 0,5', () => {
    expect(shownFraction({ width: 1280, height: 720 }, frame, 1)).toEqual({ w: 1, h: 1 });
    expect(shownFraction({ width: 1280, height: 720 }, frame, 0.5)).toEqual({ w: 0.5, h: 0.5 });
  });

  it('mídia vertical em quadro horizontal ocupa a altura toda e pouca largura', () => {
    const s = shownFraction({ width: 1080, height: 1920 }, frame, 1);
    expect(s.h).toBe(1);
    expect(s.w).toBeCloseTo(0.31640625, 6);
  });
});

describe('positionFor', () => {
  const asset = { width: 1920, height: 1080 };

  it('centro é sempre (0, 0)', () => {
    expect(positionFor('center', asset, frame, 0.4)).toEqual({ x: 0, y: 0 });
  });

  it('cantos encostam o clipe reduzido nas bordas do quadro', () => {
    // clipe a 40%: sobram 30% de cada lado do centro
    expect(positionFor('top-left', asset, frame, 0.4)).toEqual({ x: -0.3, y: -0.3 });
    expect(positionFor('bottom-right', asset, frame, 0.4)).toEqual({ x: 0.3, y: 0.3 });
    expect(positionFor('top-right', asset, frame, 0.4)).toEqual({ x: 0.3, y: -0.3 });
  });

  it('topo/base/esquerda/direita mexem em um só eixo', () => {
    expect(positionFor('top', asset, frame, 0.5)).toEqual({ x: 0, y: -0.25 });
    expect(positionFor('bottom', asset, frame, 0.5)).toEqual({ x: 0, y: 0.25 });
    expect(positionFor('left', asset, frame, 0.5)).toEqual({ x: -0.25, y: 0 });
    expect(positionFor('right', asset, frame, 0.5)).toEqual({ x: 0.25, y: 0 });
  });

  it('clipe que já passa do quadro fica centralizado no eixo que passa', () => {
    expect(positionFor('top-left', asset, frame, 1.5)).toEqual({ x: 0, y: 0 });
    // vertical num quadro horizontal: ocupa a altura toda (nada a deslocar em y), mas sobra largura
    const p = positionFor('top-left', { width: 1080, height: 1920 }, frame, 1);
    expect(p.y).toBe(0);
    expect(p.x).toBeCloseTo(-(0.5 - 0.31640625 / 2), 6);
  });

  it('as nove predefinições existem e são distintas quando o clipe é pequeno', () => {
    const seen = new Set(POSITION_PRESETS.map((p) => JSON.stringify(positionFor(p, asset, frame, 0.3))));
    expect(seen.size).toBe(9);
  });
});

describe('coverScale', () => {
  it('mesma proporção: escala 1; vertical em quadro horizontal cresce para cobrir', () => {
    expect(coverScale({ width: 1280, height: 720 }, frame)).toBe(1);
    // 1080x1920 cabe pela altura (0,5625 × 1080 = 607 px de largura); cobrir exige 1920 px de largura
    expect(coverScale({ width: 1080, height: 1920 }, frame)).toBeCloseTo(1920 / (1080 * (1080 / 1920)), 4);
  });

  it('o resultado realmente cobre o quadro nos dois eixos', () => {
    for (const asset of [{ width: 1080, height: 1920 }, { width: 4000, height: 1000 }, { width: 800, height: 800 }]) {
      const s = coverScale(asset, frame);
      const shown = shownFraction(asset, frame, s);
      expect(Math.max(shown.w, shown.h)).toBeGreaterThanOrEqual(1 - 1e-6);
      expect(Math.min(shown.w, shown.h)).toBeGreaterThanOrEqual(1 - 1e-6);
    }
  });
});
