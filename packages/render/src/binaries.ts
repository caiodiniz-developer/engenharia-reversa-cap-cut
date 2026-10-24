import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Caminho do FFmpeg: variável FFMPEG_PATH tem prioridade; senão o binário do ffmpeg-static. */
export function ffmpegPath(): string {
  const env = process.env.FFMPEG_PATH;
  if (env) return env;
  const p = require('ffmpeg-static') as string | null;
  if (!p) throw new Error('ffmpeg-static não possui binário para esta plataforma; defina FFMPEG_PATH');
  return p;
}

export function ffprobePath(): string {
  const env = process.env.FFPROBE_PATH;
  if (env) return env;
  return (require('ffprobe-static') as { path: string }).path;
}
