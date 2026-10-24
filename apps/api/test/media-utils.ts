import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { extractFrame, probeMedia } from '@editor/render';

export { probeMedia };

/** Cor RGB do pixel central do quadro em `time`. */
export async function pixelAtFile(file: string, time: number): Promise<[number, number, number]> {
  const out = path.join(await mkdtemp(path.join(os.tmpdir(), 'frame-')), 'f.png');
  await extractFrame(file, out, time);
  const img = await loadImage(out);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}
