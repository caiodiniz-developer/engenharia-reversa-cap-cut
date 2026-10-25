import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ffprobePath } from './binaries';
import { ffmpegRun } from './media';

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  kind: 'video' | 'audio' | 'image';
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  format: string;
  videoCodec?: string;
  audioCodec?: string;
  size: number;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  disposition?: { attached_pic?: number };
}

function parseRate(r?: string): number {
  if (!r) return 0;
  const [n, d] = r.split('/').map(Number);
  return d ? n! / d : n || 0;
}

const IMAGE_CODECS = new Set(['png', 'mjpeg', 'webp', 'bmp', 'gif', 'tiff', 'jpegls']);

/**
 * Duração real medida decodificando o arquivo até o fim. Necessário para contêineres gravados em fluxo
 * (WebM do MediaRecorder do navegador), que não trazem a duração no cabeçalho.
 */
export async function measureDecodedDuration(file: string): Promise<number> {
  const { stderr } = await ffmpegRun(['-i', file, '-f', 'null', '-'], 10 * 60_000);
  const all = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = all[all.length - 1];
  return last ? Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) : 0;
}

/** Lê metadados com ffprobe (sem shell; caminho passado como argumento). */
export async function probeMedia(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(
    ffprobePath(),
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { maxBuffer: 16 * 1024 * 1024, timeout: 60_000 },
  );
  const info = JSON.parse(stdout) as { streams?: FfprobeStream[]; format?: { duration?: string; format_name?: string; size?: string } };
  const streams = info.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video && !audio) throw new Error('Arquivo sem fluxo de vídeo ou áudio');
  const formatDuration = Number(info.format?.duration ?? 0) || 0;
  const format = info.format?.format_name ?? '';
  const isImage =
    !!video &&
    !audio &&
    (video.disposition?.attached_pic === 1 || /image2|png_pipe|jpeg_pipe|webp_pipe|bmp_pipe|tiff_pipe/.test(format)) &&
    IMAGE_CODECS.has(video.codec_name ?? '');
  let duration = isImage ? 0 : formatDuration || Number(video?.duration ?? audio?.duration ?? 0) || 0;
  if (!isImage && duration <= 0) duration = await measureDecodedDuration(file);
  return {
    kind: isImage ? 'image' : video ? 'video' : 'audio',
    duration,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: parseRate(video?.avg_frame_rate) || parseRate(video?.r_frame_rate),
    hasAudio: !!audio,
    format,
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    size: Number(info.format?.size ?? 0) || 0,
  };
}
