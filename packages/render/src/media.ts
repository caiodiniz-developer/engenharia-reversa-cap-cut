import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { peaks, type Range } from '@editor/core';
import { ffmpegPath } from './binaries';

const execFileAsync = promisify(execFile);

/** Executa o ffmpeg com argumentos fixos (sem shell) e devolve stderr (onde ele escreve análises). */
export async function ffmpegRun(args: string[], timeoutMs = 10 * 60_000): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(ffmpegPath(), ['-hide_banner', '-nostdin', ...args], { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs });
}

export interface TestVideoOptions {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  /** Cor sólida (hex sem #) em vez do padrão de teste. */
  color?: string;
  /** Frequência do tom de áudio; 0/undefined = sem áudio. */
  tone?: number;
}

/** Gera mídia sintética pequena e determinística (usada em testes e no modo demonstração). */
export async function generateTestVideo(out: string, o: TestVideoOptions): Promise<void> {
  const w = o.width ?? 320;
  const h = o.height ?? 180;
  const fps = o.fps ?? 30;
  const src = o.color ? `color=c=0x${o.color}:s=${w}x${h}:r=${fps}:d=${o.duration}` : `testsrc2=s=${w}x${h}:r=${fps}:d=${o.duration}`;
  const args = ['-y', '-f', 'lavfi', '-i', src];
  if (o.tone) args.push('-f', 'lavfi', '-i', `sine=frequency=${o.tone}:sample_rate=48000:duration=${o.duration}`);
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', String(fps));
  if (o.tone) args.push('-c:a', 'aac', '-b:a', '96k', '-shortest');
  args.push(out);
  await ffmpegRun(args);
}

export async function extractFrame(file: string, out: string, time: number, width?: number): Promise<void> {
  const vf = width ? ['-vf', `scale=${width}:-2`] : [];
  await ffmpegRun(['-y', '-ss', String(time), '-i', file, '-frames:v', '1', ...vf, out]);
}

export const extractThumbnail = (file: string, out: string, time = 0, width = 320) => extractFrame(file, out, time, width);

/** Proxy leve para o preview no navegador (H.264 baixa resolução, GOP curto para seek rápido). */
export async function createProxy(file: string, out: string, height = 360): Promise<void> {
  await ffmpegRun([
    '-y', '-i', file,
    '-vf', `scale=-2:${height}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-g', '15', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    out,
  ]);
}

/** Decodifica o áudio para mono 8 kHz e devolve picos normalizados (0..1) para a forma de onda. */
export function waveformPeaks(file: string, buckets = 800): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg falhou ao extrair áudio: ${err.slice(-300)}`));
      const buf = Buffer.concat(chunks);
      const samples = new Float32Array(Math.floor(buf.length / 2));
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(i * 2) / 32768;
      resolve(samples.length ? peaks(samples, buckets) : new Float32Array(buckets));
    });
  });
}

/** Silêncios via filtro silencedetect. */
export async function detectSilenceFfmpeg(file: string, opts: { noiseDb?: number; minDuration?: number } = {}): Promise<Range[]> {
  const { stderr } = await ffmpegRun(['-i', file, '-vn', '-af', `silencedetect=noise=${opts.noiseDb ?? -35}dB:d=${opts.minDuration ?? 0.5}`, '-f', 'null', '-']);
  const out: Range[] = [];
  let start: number | undefined;
  for (const line of stderr.split('\n')) {
    const s = /silence_start: (-?[\d.]+)/.exec(line);
    if (s) start = Math.max(0, Number(s[1]));
    const e = /silence_end: (-?[\d.]+)/.exec(line);
    if (e && start !== undefined) {
      out.push({ start, end: Number(e[1]) });
      start = undefined;
    }
  }
  return out;
}

/** Instantes de troca de cena (0..1 = sensibilidade; menor = mais cortes). */
export async function detectScenes(file: string, threshold = 0.4): Promise<number[]> {
  const { stderr } = await ffmpegRun(['-i', file, '-an', '-vf', `select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-']);
  const times: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) times.push(Number(m[1]));
  return times;
}

/** Áudio mono 16 kHz em WAV, formato esperado por modelos de transcrição. */
export async function extractAudioWav(file: string, out: string): Promise<void> {
  await ffmpegRun(['-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out]);
}

/** Média de energia RMS por janela (para detectar batidas/ritmo). */
export async function energyEnvelope(file: string, windowSec = 0.05): Promise<number[]> {
  const w = await waveformPeaks(file, 4000);
  const dur = (await import('./probe')).probeMedia(file).then((p) => p.duration);
  const total = await dur;
  const step = Math.max(1, Math.round((windowSec / total) * w.length));
  const out: number[] = [];
  for (let i = 0; i < w.length; i += step) {
    let s = 0;
    const end = Math.min(w.length, i + step);
    for (let k = i; k < end; k++) s += w[k]! ** 2;
    out.push(Math.sqrt(s / (end - i)));
  }
  return out;
}
