import type { MediaClip } from '@editor/core';
import { keyframeExpr, num } from './expr';

/** Encadeia atempo (cada estágio aceita 0,5–2) para velocidades arbitrárias. */
export function atempoChain(speed: number): string[] {
  const out: string[] = [];
  let s = speed;
  while (s > 2) {
    out.push('atempo=2');
    s /= 2;
  }
  while (s < 0.5) {
    out.push('atempo=0.5');
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-9) out.push(`atempo=${num(s)}`);
  return out;
}

/**
 * Cadeia de filtros de áudio de um clipe de mídia (já com o stream de entrada recortado por -ss/-t).
 * fadeIn/fadeOut são os efetivos (incluem o crossfade criado por transições).
 */
/** Medição da 1ª passada do loudnorm (valores em LUFS/dBTP/LU). */
export interface Loudness {
  input_i: number;
  input_tp: number;
  input_lra: number;
  input_thresh: number;
  target_offset: number;
}

/** Filtro de 2ª passada do loudnorm: ganho linear calculado a partir da medição (sem "bombeamento"). */
export function loudnormPass2(m: Loudness): string {
  return `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

/** Interpreta o bloco JSON que o loudnorm imprime no fim do log (print_format=json). Devolve undefined se o áudio é silencioso. */
export function parseLoudnorm(stderr: string): Loudness | undefined {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start === -1 || end < start) return undefined;
  const raw = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
  const out: Loudness = {
    input_i: Number(raw.input_i),
    input_tp: Number(raw.input_tp),
    input_lra: Number(raw.input_lra),
    input_thresh: Number(raw.input_thresh),
    target_offset: Number(raw.target_offset),
  };
  return Object.values(out).every(Number.isFinite) ? out : undefined;
}

export function audioChain(
  clip: MediaClip,
  sampleRate: number,
  fades: { fadeIn: number; fadeOut: number },
  loudness?: Loudness,
): string[] {
  const a = clip.audio;
  const f: string[] = [`aresample=${sampleRate}`, 'aformat=channel_layouts=stereo', 'asetpts=PTS-STARTPTS'];
  if (clip.reverse) f.push('areverse');
  f.push(...atempoChain(clip.speed));
  f.push(`atrim=duration=${num(clip.duration)}`, 'asetpts=PTS-STARTPTS');
  if (a.denoise) f.push('afftdn=nf=-25');
  if (a.eq.bass) f.push(`bass=g=${num(a.eq.bass)}:f=100`);
  if (a.eq.mid) f.push(`equalizer=f=1000:t=q:w=1:g=${num(a.eq.mid)}`);
  if (a.eq.treble) f.push(`treble=g=${num(a.eq.treble)}:f=8000`);
  if (a.normalize && loudness) f.push(loudnormPass2(loudness));
  if (a.pan !== 0) {
    const l = a.pan > 0 ? 1 - a.pan : 1;
    const r = a.pan < 0 ? 1 + a.pan : 1;
    f.push(`pan=stereo|c0=${num(l)}*c0|c1=${num(r)}*c1`);
  }
  const vk = clip.keyframes.volume;
  if (vk && vk.length > 0) f.push(`volume=volume='${keyframeExpr(vk, a.volume, 't')}':eval=frame`);
  else if (a.volume !== 1) f.push(`volume=${num(a.volume)}`);
  const fi = Math.min(fades.fadeIn, clip.duration);
  const fo = Math.min(fades.fadeOut, clip.duration);
  if (fi > 0) f.push(`afade=t=in:st=0:d=${num(fi)}`);
  if (fo > 0) f.push(`afade=t=out:st=${num(Math.max(0, clip.duration - fo))}:d=${num(fo)}`);
  return f;
}
