import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, MediaClip, Project, TransitionType } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { addTrack } from './tracks';
import { addClip, deleteClips, splitClip } from './clips';
import {
  assertTracksValid,
  assertUnlocked,
  replaceClip,
  requireClip,
  requireTrack,
  shiftFrom,
  withTrackClips,
} from './helpers';
import { findClip } from '../project';

function requireMedia(p: Project, id: string): MediaClip {
  const { clip } = requireClip(p, id);
  if (clip.type !== 'media') throw new TimelineError('A operação só vale para clipes de mídia', 'KIND_MISMATCH');
  return clip;
}

/** Altera a velocidade mantendo o trecho de origem; a duração na timeline muda proporcionalmente. */
export function setSpeed(p: Project, clipId: string, speed: number): Project {
  const clip = requireMedia(p, clipId);
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  if (speed < 0.1 || speed > 16) throw new TimelineError('Velocidade deve estar entre 0,1x e 16x', 'INVALID');
  const ratio = clip.speed / speed;
  const scaleKf = (kfs: MediaClip['keyframes']['x']) => kfs?.map((k) => ({ ...k, time: round6(k.time * ratio) }));
  const next: MediaClip = {
    ...clip,
    speed,
    duration: round6(clip.duration * ratio),
    keyframes: {
      x: scaleKf(clip.keyframes.x),
      y: scaleKf(clip.keyframes.y),
      scale: scaleKf(clip.keyframes.scale),
      rotation: scaleKf(clip.keyframes.rotation),
      opacity: scaleKf(clip.keyframes.opacity),
      volume: scaleKf(clip.keyframes.volume),
    },
  };
  const out = replaceClip(p, next);
  assertTracksValid(out, [track.id]);
  return out;
}

export function setReverse(p: Project, clipId: string, reverse: boolean): Project {
  const clip = requireMedia(p, clipId);
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  return replaceClip(p, { ...clip, reverse });
}

/**
 * Congela o quadro no instante `time`: divide o clipe, insere um clipe de quadro parado com `duration`
 * segundos entre as metades e empurra o restante da faixa.
 */
export function freezeFrame(p: Project, clipId: string, time: number, duration = 2): { project: Project; freezeId: string } {
  const clip = requireMedia(p, clipId);
  const asset = p.media[clip.mediaId];
  if (!asset || asset.kind !== 'video') throw new TimelineError('Só é possível congelar quadros de vídeo', 'KIND_MISMATCH');
  const d1 = round6(time - clip.start);
  const sourceAt = clip.reverse ? round6(clip.sourceIn + (clip.duration - d1) * clip.speed) : round6(clip.sourceIn + d1 * clip.speed);
  const { project: split, rightId } = splitClip(p, clipId, time);
  const { track } = requireClip(split, clipId);
  const right = requireClip(split, rightId).clip;
  const shifted = withTrackClips(split, track.id, (cs) => shiftFrom(cs, right.start, duration, new Set()));
  const freeze: MediaClip = {
    ...clip,
    id: newId('clp'),
    start: round6(time),
    duration,
    sourceIn: Math.min(sourceAt, Math.max(0, asset.duration - 0.001)),
    speed: 1,
    reverse: false,
    freeze: true,
    linkId: undefined,
    transitionIn: undefined,
    keyframes: {},
    effects: clip.effects.map((e) => ({ ...e, id: newId('fx') })),
    audio: { ...clip.audio, muted: true, fadeIn: 0, fadeOut: 0 },
  };
  const out = addClip(shifted, track.id, freeze);
  return { project: out, freezeId: freeze.id };
}

/** Cria um clipe de áudio ligado ao vídeo e silencia o áudio embutido do vídeo. */
export function extractAudio(p: Project, clipId: string): { project: Project; audioId: string } {
  const clip = requireMedia(p, clipId);
  const asset = p.media[clip.mediaId];
  if (!asset || asset.kind !== 'video' || !asset.hasAudio) {
    throw new TimelineError('Este clipe não possui áudio para extrair', 'KIND_MISMATCH');
  }
  if (clip.audio.muted) throw new TimelineError('O áudio deste clipe já foi extraído ou está silenciado', 'INVALID');
  const linkId = clip.linkId ?? newId('lnk');
  const audioClip: MediaClip = {
    ...clip,
    id: newId('clp'),
    linkId,
    transitionIn: undefined,
    effects: [],
    mask: undefined,
    transform: { ...clip.transform },
    keyframes: { volume: clip.keyframes.volume },
  };
  // Escolhe uma faixa de áudio livre no intervalo; se não houver, cria uma nova.
  let next = p;
  let target = next.tracks.find(
    (t) => t.kind === 'audio' && !t.locked && !t.clips.some((c) => c.start < clipEnd(audioClip) - EPS && clipEnd(c) > audioClip.start + EPS),
  );
  if (!target) {
    const r = addTrack(next, 'audio');
    next = r.project;
    target = r.track;
  }
  next = addClip(next, target.id, audioClip);
  next = replaceClip(next, { ...requireMedia(next, clipId), linkId, audio: { ...clip.audio, muted: true } });
  return { project: next, audioId: audioClip.id };
}

export function unlinkClips(p: Project, ids: string[]): Project {
  let next = p;
  for (const id of ids) {
    const { clip } = requireClip(next, id);
    next = replaceClip(next, { ...clip, linkId: undefined } as Clip);
  }
  return next;
}

export function groupClips(p: Project, ids: string[]): { project: Project; groupId: string } {
  if (ids.length < 2) throw new TimelineError('Selecione ao menos dois clipes para agrupar', 'INVALID');
  const groupId = newId('grp');
  let next = p;
  for (const id of ids) next = replaceClip(next, { ...requireClip(next, id).clip, groupId } as Clip);
  return { project: next, groupId };
}

export function ungroupClips(p: Project, ids: string[]): Project {
  let next = p;
  for (const id of ids) next = replaceClip(next, { ...requireClip(next, id).clip, groupId: undefined } as Clip);
  return next;
}

function previousClip(p: Project, clipId: string): { prev: Clip; trackId: string } {
  const { track, clip } = requireClip(p, clipId);
  const before = track.clips.filter((c) => c.id !== clipId && c.start < clip.start - EPS);
  const prev = before.sort((a, b) => clipEnd(b) - clipEnd(a))[0];
  if (!prev) throw new TimelineError('Não há clipe anterior para aplicar a transição', 'INVALID');
  return { prev, trackId: track.id };
}

/**
 * Aplica (ou altera) uma transição na entrada do clipe. O clipe é puxado para a esquerda, junto com
 * o restante da faixa, para criar a sobreposição de `duration` segundos com o clipe anterior.
 */
export function setTransition(p: Project, clipId: string, type: TransitionType, duration: number): Project {
  const clip = requireMedia(p, clipId);
  const { prev, trackId } = previousClip(p, clipId);
  if (prev.type !== 'media') throw new TimelineError('Transições só existem entre clipes de mídia', 'KIND_MISMATCH');
  assertUnlocked(requireTrack(p, trackId));
  const maxDur = round6(Math.min(prev.duration, clip.duration) * 0.9);
  if (duration <= 0 || duration > maxDur + EPS) {
    throw new TimelineError(`A duração da transição deve estar entre 0 e ${maxDur}s`, 'OUT_OF_RANGE');
  }
  const currentOverlap = round6(Math.max(0, clipEnd(prev) - clip.start));
  if (currentOverlap <= EPS && clip.start - clipEnd(prev) > 1e-3) {
    throw new TimelineError('Os clipes precisam estar encostados para aplicar uma transição', 'INVALID');
  }
  const shift = round6(currentOverlap - duration);
  const moved = withTrackClips(p, trackId, (cs) =>
    shiftFrom(cs, clip.start, shift).map((c) => (c.id === clipId ? ({ ...c, transitionIn: { type, duration } } as Clip) : c)),
  );
  assertTracksValid(moved, [trackId]);
  return moved;
}

export function removeTransition(p: Project, clipId: string): Project {
  const clip = requireMedia(p, clipId);
  if (!clip.transitionIn) return p;
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  const { prev } = previousClip(p, clipId);
  const overlap = round6(Math.max(0, clipEnd(prev) - clip.start));
  const out = withTrackClips(p, track.id, (cs) =>
    shiftFrom(cs, clip.start, overlap).map((c) => (c.id === clipId ? ({ ...c, transitionIn: undefined } as Clip) : c)),
  );
  assertTracksValid(out, [track.id]);
  return out;
}

/** Remove trechos [start,end) (tempo da timeline) de um clipe, fechando os vãos (ex.: pausas/silêncios). */
export function removeRanges(p: Project, clipId: string, ranges: Array<{ start: number; end: number }>): Project {
  const orig = requireClip(p, clipId).clip;
  const min = 1 / p.settings.fps;
  const inside = ranges
    .map((r) => ({ start: Math.max(r.start, orig.start), end: Math.min(r.end, clipEnd(orig)) }))
    .filter((r) => r.end - r.start >= min - EPS)
    .sort((a, b) => b.start - a.start);
  let next = p;
  // Do fim para o início: o pedaço esquerdo mantém o id original e não é afetado pelos cortes posteriores.
  for (const r of inside) {
    if (!findClip(next, clipId)) break;
    let c = requireClip(next, clipId).clip;
    if (r.end < clipEnd(c) - min / 2) next = splitClip(next, clipId, r.end).project;
    c = requireClip(next, clipId).clip;
    let doomed = clipId;
    if (r.start > c.start + min / 2) {
      const s = splitClip(next, clipId, r.start);
      next = s.project;
      doomed = s.rightId;
    }
    next = deleteClips(next, [doomed], { ripple: true });
  }
  return next;
}

/**
 * Remove os espaços vazios de uma faixa: cada clipe é puxado para encostar no anterior (o primeiro vai para 0).
 * A sobreposição de transições é preservada.
 */
export function closeGaps(p: Project, trackId: string): Project {
  const track = requireTrack(p, trackId);
  assertUnlocked(track);
  const sorted = [...track.clips].sort((a, b) => a.start - b.start);
  let cursor = 0;
  const moved: Clip[] = [];
  for (const c of sorted) {
    const start = round6(c.type === 'media' && c.transitionIn && moved.length ? Math.max(0, cursor - c.transitionIn.duration) : cursor);
    moved.push({ ...c, start } as Clip);
    cursor = round6(start + c.duration);
  }
  const out = withTrackClips(p, trackId, () => moved);
  assertTracksValid(out, [trackId]);
  return out;
}
