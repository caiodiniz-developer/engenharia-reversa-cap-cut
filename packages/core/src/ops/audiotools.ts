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
