import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ffmpegPath } from './binaries';
import { generateTestVideo } from './media';
import { measureDecodedDuration, probeMedia } from './probe';
import { makeTmp } from './testutil';

/** Grava um WebM/Opus em fluxo (stdout não é "seekable"): sem duração no cabeçalho, como o MediaRecorder. */
async function streamedWebm(out: string, seconds: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=330:sample_rate=48000:duration=${seconds}`, '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.pipe(createWriteStream(out));
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}`))));
  });
}

describe('duração de mídia sem cabeçalho de duração', () => {
  it('WebM gravado em fluxo: o ffprobe não informa, mas a medição por decodificação acerta', async () => {
    const dir = await makeTmp('probe-');
    const file = path.join(dir, 'voz.webm');
    await streamedWebm(file, 2.4);
    const d = await measureDecodedDuration(file);
    expect(d).toBeGreaterThan(2.2);
    expect(d).toBeLessThan(2.7);
    const info = await probeMedia(file);
    expect(info.kind).toBe('audio');
    expect(info.duration).toBeGreaterThan(2.2);
    expect(info.hasAudio).toBe(true);
  });

  it('arquivos normais continuam usando a duração do cabeçalho (sem decodificar)', async () => {
    const dir = await makeTmp('probe-');
    const file = path.join(dir, 'v.mp4');
    await generateTestVideo(file, { duration: 1.5, color: 'ff0000', tone: 440 });
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(1.4);
    expect(info.duration).toBeLessThan(1.7);
  });
});
