import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { renderBackgroundPng, renderShapePng } from './generated';
import { makeTmp } from './testutil';

async function pixels(png: Buffer, points: Array<[number, number]>) {
  const dir = await makeTmp('gen-');
  const file = path.join(dir, 'f.png');
  await writeFile(file, png);
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)));
}

describe('fundos gerados', () => {
  it('cor sólida preenche todo o quadro', async () => {
    const png = renderBackgroundPng({ kind: 'solid', color: '#336699', width: 64, height: 32 });
    const [a, b] = await pixels(png, [[0, 0], [63, 31]]);
    expect(a).toEqual([0x33, 0x66, 0x99]);
    expect(b).toEqual([0x33, 0x66, 0x99]);
  });

  it('degradê vertical (180°): topo = cor 1 e base = cor 2', async () => {
    const png = renderBackgroundPng({ kind: 'gradient', color: '#ff0000', color2: '#0000ff', angle: 180, width: 40, height: 100 });
    const [top, mid, bottom] = await pixels(png, [[20, 0], [20, 50], [20, 99]]);
    expect(top![0]).toBeGreaterThan(240);
    expect(bottom![2]).toBeGreaterThan(240);
    expect(Math.abs(mid![0]! - 128)).toBeLessThan(12);
  });

  it('degradê horizontal (90°): esquerda = cor 1 e direita = cor 2', async () => {
    const png = renderBackgroundPng({ kind: 'gradient', color: '#00ff00', color2: '#ff00ff', angle: 90, width: 100, height: 40 });
    const [left, right] = await pixels(png, [[0, 20], [99, 20]]);
    expect(left![1]).toBeGreaterThan(240);
    expect(right![0]).toBeGreaterThan(240);
  });

  it('recusa cores e dimensões inválidas', () => {
    expect(() => renderBackgroundPng({ kind: 'solid', color: 'vermelho', width: 64, height: 64 })).toThrow(/Cor inválida/);
    expect(() => renderBackgroundPng({ kind: 'gradient', color: '#000000', width: 64, height: 64 })).toThrow(/Cor inválida/);
    expect(() => renderBackgroundPng({ kind: 'solid', color: '#000000', width: 99999, height: 64 })).toThrow(/Dimensões/);
    expect(() => renderBackgroundPng({ kind: 'solid', color: '#000000', width: 10.5, height: 64 })).toThrow(/Dimensões/);
  });
});

async function rgba(png: Buffer, points: Array<[number, number]>) {
  const dir = await makeTmp('shape-');
  const file = path.join(dir, 'f.png');
  await writeFile(file, png);
  const img = await loadImage(file);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return points.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
}

describe('formas geradas', () => {
  const S = 200;
  const opaque = (p: number[] | undefined) => p![3]! > 250;
  const clear = (p: number[] | undefined) => p![3]! < 5;

  it('círculo: centro opaco na cor pedida e cantos transparentes', async () => {
    const [center, corner, edgeInside] = await rgba(renderShapePng({ shape: 'circle', color: '#ff8800', size: S }), [[100, 100], [2, 2], [100, 30]]);
    expect(Array.from(center!.slice(0, 3))).toEqual([0xff, 0x88, 0x00]);
    expect(opaque(center)).toBe(true);
    expect(clear(corner)).toBe(true);
    expect(opaque(edgeInside)).toBe(true);
  });

  it('quadrado preenche até perto das bordas; arredondado deixa os cantos vazios', async () => {
    const sq = await rgba(renderShapePng({ shape: 'square', color: '#00ff00', size: S }), [[20, 20], [5, 5]]);
    expect(opaque(sq[0])).toBe(true);
    expect(clear(sq[1])).toBe(true);
    const rd = await rgba(renderShapePng({ shape: 'rounded', color: '#00ff00', size: S }), [[100, 100], [20, 20]]);
    expect(opaque(rd[0])).toBe(true);
    expect(clear(rd[1])).toBe(true);
  });

  it('triângulo: ápice acima do centro, base larga, cantos superiores vazios', async () => {
    const [apexBelow, baseLeft, topLeft, topRight] = await rgba(renderShapePng({ shape: 'triangle', color: '#0000ff', size: S }), [[100, 40], [30, 180], [30, 30], [170, 30]]);
    expect(opaque(apexBelow)).toBe(true);
    expect(opaque(baseLeft)).toBe(true);
    expect(clear(topLeft)).toBe(true);
    expect(clear(topRight)).toBe(true);
  });

  it('seta e linha: haste central preenchida, extremos verticais vazios', async () => {
    const arrow = await rgba(renderShapePng({ shape: 'arrow', color: '#ffffff', size: S }), [[60, 100], [60, 10], [60, 190]]);
    expect(opaque(arrow[0])).toBe(true);
    expect(clear(arrow[1])).toBe(true);
    expect(clear(arrow[2])).toBe(true);
    const line = await rgba(renderShapePng({ shape: 'line', color: '#ffffff', size: S }), [[100, 100], [100, 60]]);
    expect(opaque(line[0])).toBe(true);
    expect(clear(line[1])).toBe(true);
  });

  it('estrela e coração têm o centro preenchido e o canto vazio', async () => {
    for (const shape of ['star', 'heart'] as const) {
      const [center, corner] = await rgba(renderShapePng({ shape, color: '#ff00ff', size: S }), [[100, 105], [3, 3]]);
      expect(opaque(center), shape).toBe(true);
      expect(clear(corner), shape).toBe(true);
    }
  });

  it('recusa forma, cor e tamanho inválidos', () => {
    expect(() => renderShapePng({ shape: 'hexagono' as never, color: '#000000' })).toThrow(/Forma/);
    expect(() => renderShapePng({ shape: 'circle', color: 'azul' })).toThrow(/Cor/);
    expect(() => renderShapePng({ shape: 'circle', color: '#000000', size: 5 })).toThrow(/Dimensões/);
  });
});
