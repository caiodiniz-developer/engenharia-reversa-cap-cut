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

/** J-cut: o áudio do clipe começa ${seconds} s antes da imagem (usa mídia que vem antes do trecho). O par continua ligado. */
export function jCut(p: Project, clipId: string, seconds: number): Project {
  if (!(seconds >= 0.05 && seconds <= 10)) throw new TimelineError('A antecipação vai de 0,05 s a 10 s', 'OUT_OF_RANGE');
  const a = linkedAudioOf(p, clipId);
  return trimClip(p, a.id, 'start', round6(a.start - seconds));
}

/** L-cut: o áudio do clipe termina ${seconds} s depois da imagem (precisa de mídia sobrando no fim). O par continua ligado. */
export function lCut(p: Project, clipId: string, seconds: number): Project {
  if (!(seconds >= 0.05 && seconds <= 10)) throw new TimelineError('O prolongamento vai de 0,05 s a 10 s', 'OUT_OF_RANGE');
  const a = linkedAudioOf(p, clipId);
  return trimClip(p, a.id, 'end', round6(clipEnd(a) + seconds));
}

/** Aplica a todos os clipes de mídia escolhidos o volume do primeiro da lista (para nivelar falas ou músicas). */
export function matchVolumeToFirst(p: Project, ids: string[]): Project {
  const media = [...new Set(ids)].map((id) => requireClip(p, id)).filter((x): x is { track: typeof x.track; clip: MediaClip; trackIndex: number } => x.clip.type === 'media');
  if (media.length < 2) throw new TimelineError('Selecione pelo menos dois clipes de áudio ou vídeo', 'OUT_OF_RANGE');
  const volume = media[0]!.clip.audio.volume;
  let next = p;
  for (const { track, clip } of media.slice(1)) {
    assertUnlocked(track);
    next = withTrackClips(next, track.id, (cs) => cs.map((c) => (c.id === clip.id ? ({ ...c, audio: { ...(c as MediaClip).audio, volume } } as Clip) : c)));
  }
  return next;
}
