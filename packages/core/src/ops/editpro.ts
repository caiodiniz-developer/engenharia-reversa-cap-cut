import { TimelineError } from '../errors';
import { newId } from '../ids';
import { allClips, projectDuration } from '../project';
import type { Clip, MediaClip, Project } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { addClip, trimClip } from './clips';
import { assertUnlocked, requireClip, shiftFrom, withTrackClips } from './helpers';
import { fadeOpacity } from './motion';

/** Clipe de áudio ligado ao clipe pedido (ou o próprio clipe, se ele já estiver numa faixa de áudio). */
function linkedAudioOf(p: Project, clipId: string): MediaClip {
  const { clip, track } = requireClip(p, clipId);
  if (clip.type !== 'media') throw new TimelineError('Essa ferramenta vale só para clipes de vídeo e áudio', 'KIND_MISMATCH');
  if (track.kind === 'audio') return clip;
  const partner = clip.linkId ? allClips(p).find((x) => x.clip.id !== clip.id && x.clip.linkId === clip.linkId && x.track.kind === 'audio')?.clip : undefined;
  if (!partner || partner.type !== 'media') throw new TimelineError('Extraia o áudio do vídeo antes (comando "Extrair áudio")', 'INVALID');
  return partner;
}
