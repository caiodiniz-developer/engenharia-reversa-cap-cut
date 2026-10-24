import { TimelineError } from '../errors';
import { findClip, findTrack } from '../project';
import type { Clip, MediaAsset, Project, Track } from '../schema';
import { EPS, clipEnd, round6 } from '../time';

export const sortClips = (clips: Clip[]): Clip[] => [...clips].sort((a, b) => a.start - b.start || a.duration - b.duration);

export const minClipDuration = (p: Project): number => round6(1 / p.settings.fps);

export function requireClip(p: Project, id: string): { track: Track; clip: Clip; trackIndex: number } {
  const found = findClip(p, id);
  if (!found) throw new TimelineError(`Clipe ${id} não encontrado`, 'NOT_FOUND');
  return found;
}

export function requireTrack(p: Project, id: string): Track {
  const t = findTrack(p, id);
  if (!t) throw new TimelineError(`Faixa ${id} não encontrada`, 'NOT_FOUND');
  return t;
}

export function assertUnlocked(track: Track): void {
  if (track.locked) throw new TimelineError(`A faixa "${track.name}" está bloqueada`, 'LOCKED');
}

/** Um clipe de mídia pode ficar em faixa de vídeo (vídeo/imagem) ou de áudio (qualquer mídia com áudio). */
export function assertClipFitsTrack(p: Project, clip: Clip, track: Track): void {
  const ok = (() => {
    switch (clip.type) {
      case 'text':
        return track.kind === 'text';
      case 'caption':
        return track.kind === 'caption';
      case 'media': {
        const asset = p.media[clip.mediaId];
        if (!asset) throw new TimelineError(`Mídia ${clip.mediaId} não encontrada`, 'NOT_FOUND');
        if (track.kind === 'video') return asset.kind === 'video' || asset.kind === 'image';
        if (track.kind === 'audio') return asset.kind === 'audio' || asset.kind === 'video';
        return false;
      }
    }
  })();
  if (!ok) throw new TimelineError(`Clipe do tipo ${clip.type} não cabe em faixa ${track.kind}`, 'KIND_MISMATCH');
}

/** Garante que o intervalo de origem usado pelo clipe cabe dentro da mídia. */
export function assertSourceRange(p: Project, clip: Clip): void {
  if (clip.type !== 'media' || clip.freeze) return;
  const asset: MediaAsset | undefined = p.media[clip.mediaId];
  if (!asset) throw new TimelineError(`Mídia ${clip.mediaId} não encontrada`, 'NOT_FOUND');
  if (asset.kind === 'image') return;
  const used = clip.duration * clip.speed;
  if (clip.sourceIn < -EPS || clip.sourceIn + used > asset.duration + 1e-3) {
    throw new TimelineError('O clipe ultrapassa a duração da mídia de origem', 'OUT_OF_RANGE');
  }
}

/**
 * Valida sobreposições em uma faixa. Sobreposição só é permitida em mídia quando o clipe
 * posterior tem transição de entrada que cobre a sobreposição.
 */
export function assertTrackValid(track: Track): void {
  const sorted = sortClips(track.clips);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      const overlap = clipEnd(a) - b.start;
      if (overlap <= EPS) break;
      const allowed =
        a.type === 'media' &&
        b.type === 'media' &&
        b.transitionIn !== undefined &&
        overlap <= b.transitionIn.duration + 1e-3;
      if (!allowed) {
        throw new TimelineError(`Sobreposição na faixa "${track.name}" entre dois clipes`, 'OVERLAP');
      }
    }
  }
}

export function withTrackClips(p: Project, trackId: string, fn: (clips: Clip[]) => Clip[]): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, clips: sortClips(fn(t.clips)) } : t)),
  };
}

/** Substitui um clipe (mantendo a faixa). */
export function replaceClip(p: Project, clip: Clip): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) =>
      t.clips.some((c) => c.id === clip.id) ? { ...t, clips: sortClips(t.clips.map((c) => (c.id === clip.id ? clip : c))) } : t,
    ),
  };
}

/** Valida todas as faixas cujos ids foram informados. */
export function assertTracksValid(p: Project, trackIds: Iterable<string>): void {
  for (const id of new Set(trackIds)) assertTrackValid(requireTrack(p, id));
}

/** Desloca por delta todos os clipes da faixa com start >= from. */
export function shiftFrom(clips: Clip[], from: number, delta: number, exceptIds: Set<string> = new Set()): Clip[] {
  return clips.map((c) => (c.start >= from - EPS && !exceptIds.has(c.id) ? { ...c, start: round6(Math.max(0, c.start + delta)) } : c));
}
