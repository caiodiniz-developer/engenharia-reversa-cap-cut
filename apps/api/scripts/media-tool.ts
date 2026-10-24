import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { extractFrame, ffmpegRun, generateTestVideo, probeMedia } from '@editor/render';

/**
 * Ferramenta de linha de comando usada pelos testes E2E (que rodam em outro processo):
 *   make            -> cria vídeos de teste e imprime os caminhos em JSON
 *   probe <arquivo> -> metadados via ffprobe
 *   pixel <arquivo> <tempo> [fx fy] -> cor RGB de um ponto do quadro (fx, fy em 0..1)
 */
const [cmd, ...args] = process.argv.slice(2);

async function main() {
  if (cmd === 'make') {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'e2e-media-'));
    await mkdir(dir, { recursive: true });
    const red = path.join(dir, 'vermelho.mp4');
    const blue = path.join(dir, 'azul.mp4');
    const talk = path.join(dir, 'fala.mp4');
    await generateTestVideo(red, { duration: 4, color: 'ff0000', tone: 440, width: 640, height: 360 });
    await generateTestVideo(blue, { duration: 4, color: '0000ff', tone: 660, width: 640, height: 360 });
    // 1 s de som, 2 s de silêncio, 1 s de som
    await ffmpegRun([
      '-y', '-f', 'lavfi', '-i', 'color=c=0x228833:s=640x360:r=30:d=4',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
      '-filter_complex', '[1][2][3]concat=n=3:v=0:a=1[a]',
      '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', talk,
    ]);
    console.log(JSON.stringify({ dir, red, blue, talk }));
  } else if (cmd === 'probe') {
    console.log(JSON.stringify(await probeMedia(args[0]!)));
  } else if (cmd === 'pixel') {
    const out = path.join(await mkdtemp(path.join(os.tmpdir(), 'px-')), 'f.png');
    await extractFrame(args[0]!, out, Number(args[1]));
    const img = await loadImage(out);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const fx = Number(args[2] ?? 0.5);
    const fy = Number(args[3] ?? 0.5);
    const d = ctx.getImageData(Math.floor(img.width * fx), Math.floor(img.height * fy), 1, 1).data;
    console.log(JSON.stringify([d[0], d[1], d[2]]));
  } else {
    throw new Error(`comando desconhecido: ${cmd}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
