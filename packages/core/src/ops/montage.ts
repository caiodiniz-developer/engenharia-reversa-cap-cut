import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, MediaClip, Project } from '../schema';
import { round6 } from '../time';
import { assertTracksValid, assertUnlocked, requireTrack, withTrackClips } from './helpers';

export interface MontageResult {
  project: Project;
  /** Quantos planos foram criados. */
  shots: number;
}

/**
 * Montagem no ritmo: refaz uma faixa de vídeo cortando nos marcadores. Cada intervalo entre dois marcadores
 * seguidos vira um plano; os clipes originais da faixa são usados em rodízio e cada um continua de onde o
 * plano anterior dele parou (voltando ao início da mídia quando acaba). Imagens simplesmente se repetem.
 *
 * Só a faixa escolhida muda: clipes ligados em outras faixas (ex.: áudio extraído) ficam como estavam.
 * Planos limitados pela mídia de origem podem ficar menores que o intervalo.
 */
export function montageOnMarkers(p: Project, trackId: string): MontageResult {
  const track = requireTrack(p, trackId);
  assertUnlocked(track);
  const sources = [...track.clips].sort((a, b) => a.start - b.start).filter((c): c is MediaClip => c.type === 'media');
  if (!sources.length) throw new TimelineError('A faixa precisa ter clipes de vídeo ou imagem para montar', 'KIND_MISMATCH');
  const times = [...new Set(p.markers.map((m) => round6(m.time)))].sort((a, b) => a - b);
  if (times.length < 2) throw new TimelineError('Marque pelo menos dois pontos de corte (M) ou detecte as batidas', 'OUT_OF_RANGE');

  const cursor = new Map<string, number>(); // quanto da origem de cada clipe já foi usado, em segundos de mídia
  const pieces: Clip[] = [];
  for (let k = 0; k < times.length - 1; k++) {
    const src = sources[k % sources.length]!;
    const asset = p.media[src.mediaId];
    const slot = round6(times[k + 1]! - times[k]!);
    if (slot <= 0) continue;
    const isImage = asset?.kind === 'image';
    const total = isImage ? Infinity : (asset?.duration ?? src.sourceIn + src.duration * src.speed) - src.sourceIn;
    let used = cursor.get(src.id) ?? 0;
    const need = slot * src.speed;
    if (!isImage && used + need > total + 1e-6) used = 0; // acabou a mídia: recomeça
    const duration = round6(isImage ? slot : Math.min(slot, total / src.speed));
    const piece: MediaClip = {
      ...JSON.parse(JSON.stringify(src)),
      id: newId('clp'),
      start: times[k]!,
      duration,
      sourceIn: round6(src.sourceIn + used),
      linkId: undefined,
      groupId: undefined,
      transitionIn: undefined,
      effects: src.effects.map((e) => ({ ...e, id: newId('fx') })),
    };
    cursor.set(src.id, used + duration * src.speed);
    pieces.push(piece);
  }
  if (!pieces.length) throw new TimelineError('Os marcadores não formam nenhum intervalo', 'OUT_OF_RANGE');
  const next = withTrackClips(p, trackId, () => pieces);
  assertTracksValid(next, [trackId]);
  return { project: next, shots: pieces.length };
}
