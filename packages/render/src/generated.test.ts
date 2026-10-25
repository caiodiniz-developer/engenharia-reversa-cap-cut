import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { renderBackgroundPng } from './generated';
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
