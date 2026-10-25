import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createFilmstrip, ffmpegRun, filmstripSpec } from './media';
import { makeTmp } from './testutil';

describe('tira de quadros (filmstrip)', () => {
  it('calcula a grade: 1 miniatura por segundo, no máximo ~60, com largura proporcional', () => {
    expect(filmstripSpec(6, 1920, 1080)).toEqual({ count: 6, interval: 1, tileW: 114, tileH: 64 });
    expect(filmstripSpec(600, 1920, 1080)).toMatchObject({ interval: 10, count: 60 });
    expect(filmstripSpec(0.4, 640, 360).count).toBe(1);
    expect(filmstripSpec(10, 1080, 1920).tileW).toBe(36); // vertical: limite mínimo
    expect(filmstripSpec(10, 4000, 1000).tileW).toBe(144); // ultrawide: limite máximo
  });

  it('gera a imagem com a miniatura certa em cada posição (vermelho → azul)', async () => {
    const dir = await makeTmp('film-');
    const src = path.join(dir, 'rb.mp4');
    await ffmpegRun([
      '-y', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=3', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=30:d=3',
      '-filter_complex', '[0][1]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', src,
    ]);
    const spec = filmstripSpec(6, 320, 180);
    const out = path.join(dir, 'film.jpg');
    await createFilmstrip(src, out, spec);
    const img = await loadImage(out);
    expect(img.width).toBe(spec.tileW * spec.count);
    expect(img.height).toBe(spec.tileH);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const at = (i: number) => Array.from(ctx.getImageData(i * spec.tileW + spec.tileW / 2, 32, 1, 1).data.slice(0, 3));
    expect(at(0)[0]).toBeGreaterThan(200);
    expect(at(0)[2]).toBeLessThan(60);
    expect(at(5)[2]).toBeGreaterThan(200);
    expect(at(5)[0]).toBeLessThan(60);
  });
});
