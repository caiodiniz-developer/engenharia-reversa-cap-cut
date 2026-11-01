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
