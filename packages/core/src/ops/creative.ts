import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, MediaClip, Project } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { setReverse } from './advanced';
import { splitClips, updateClip } from './clips';
import { assertTracksValid, assertUnlocked, requireClip, shiftFrom, withTrackClips } from './helpers';
import { mapTransform } from './motion';
import { sequenceOrder } from './reorder';
import { repeatClip } from './repeat';
import type { Corner } from './texttools';

/** Clipe de mídia pedido (falha com mensagem clara se for texto ou legenda). */
function requireMediaClip(p: Project, id: string): MediaClip {
  const { clip } = requireClip(p, id);
  if (clip.type !== 'media') throw new TimelineError('Essa ferramenta vale só para clipes de vídeo, imagem ou áudio', 'KIND_MISMATCH');
  return clip;
}

/** Cópia independente de um clipe de mídia: id novo, sem ligação, grupo ou transição, com efeitos de ids novos. */
function cloneMedia(clip: MediaClip): MediaClip {
  const copy: MediaClip = JSON.parse(JSON.stringify(clip));
  copy.id = newId('clp');
  copy.linkId = undefined;
  copy.groupId = undefined;
  copy.transitionIn = undefined;
  copy.effects = copy.effects.map((e) => ({ ...e, id: newId('fx') }));
  return copy;
}
