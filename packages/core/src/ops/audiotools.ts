import { TimelineError } from '../errors';
import { findClip } from '../project';
import { upsertKeyframe } from '../keyframes';
import type { AudioProps, Clip, Keyframe, MediaClip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { updateClip } from './clips';
import { requireClip } from './helpers';

const isMedia = (c: Clip): c is MediaClip => c.type === 'media';

/** Aplica fn a cada clipe de mídia dentre os ids (os demais são ignorados); falha se nenhum for de mídia. */
export function mapMediaClips(p: Project, ids: string[], fn: (c: MediaClip) => MediaClip): Project {
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    if (!isMedia(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => fn(c as MediaClip));
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou áudio', 'KIND_MISMATCH');
  return next;
}

const withAudio = (c: MediaClip, patch: Partial<AudioProps>): MediaClip => ({ ...c, audio: { ...c.audio, ...patch } });

/** Define o volume (0 a 4, onde 1 = 100%) de todos os clipes escolhidos. */
export function setVolume(p: Project, ids: string[], volume: number): Project {
  if (!(volume >= 0 && volume <= 4)) throw new TimelineError('O volume vai de 0% a 400%', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => withAudio(c, { volume: round6(volume) }));
}

/** Soma ganho em dB ao volume de cada clipe (+6 dB dobra, -6 dB divide por dois), limitado a 0–400%. */
export function adjustVolumeDb(p: Project, ids: string[], db: number): Project {
  if (!Number.isFinite(db)) throw new TimelineError('Informe o ganho em dB', 'INVALID');
  const gain = Math.pow(10, db / 20);
  return mapMediaClips(p, ids, (c) => withAudio(c, { volume: round6(Math.min(4, Math.max(0, c.audio.volume * gain))) }));
}

/** Silencia (ou reativa) o som dos clipes escolhidos. */
export function setMuted(p: Project, ids: string[], muted: boolean): Project {
  return mapMediaClips(p, ids, (c) => withAudio(c, { muted }));
}

/** Define fade de entrada e de saída (segundos). Se somarem mais que o clipe, os dois encolhem na mesma proporção. */
export function setFades(p: Project, ids: string[], fadeIn: number, fadeOut: number): Project {
  if (!(fadeIn >= 0) || !(fadeOut >= 0)) throw new TimelineError('Os fades não podem ser negativos', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => {
    const total = fadeIn + fadeOut;
    const k = total > c.duration ? c.duration / total : 1;
    return withAudio(c, { fadeIn: round6(fadeIn * k), fadeOut: round6(fadeOut * k) });
  });
}
