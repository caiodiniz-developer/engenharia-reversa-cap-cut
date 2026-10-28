import { TimelineError } from '../errors';
import type { MediaClip, Project } from '../schema';
import { round6 } from '../time';
import { assertSourceRange, assertTracksValid, assertUnlocked, requireClip, withTrackClips } from './helpers';

export const FIT_MIN_FACTOR = 0.5;
export const FIT_MAX_FACTOR = 2;

/**
 * Fator de velocidade que faz `current` segundos virarem `target` (fator > 1 acelera).
 * Devolve `null` se pedir mais que 2× ou menos que 0,5× — fora disso a imagem fica ridícula.
 */
export function fitFactor(current: number, target: number): number | null {
  if (!(current > 0) || !(target > 0)) return null;
  const f = round6(current / target);
  return f < FIT_MIN_FACTOR - 1e-9 || f > FIT_MAX_FACTOR + 1e-9 ? null : f;
}

/**
 * Encaixa os clipes de mídia escolhidos (da mesma faixa) em `targetSeconds` no total, mudando a velocidade de todos
 * pelo mesmo fator e deixando-os em sequência, sem espaços. Falha se a velocidade resultante passar do limite do editor (0,1–16×) ou se algum clipe não escolhido atrapalhar.
 */
export function fitClipsToDuration(p: Project, ids: string[], targetSeconds: number): { project: Project; factor: number } {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new TimelineError('Selecione os clipes que devem caber na duração', 'OUT_OF_RANGE');
  const found = unique.map((id) => requireClip(p, id));
  if (found.some((f) => f.clip.type !== 'media')) throw new TimelineError('Só clipes de vídeo ou áudio mudam de velocidade', 'KIND_MISMATCH');
  const trackId = found[0]!.track.id;
  if (found.some((f) => f.track.id !== trackId)) throw new TimelineError('Os clipes precisam estar na mesma faixa', 'KIND_MISMATCH');
  const current = found.reduce((n, f) => n + f.clip.duration, 0);
  const factor = fitFactor(current, targetSeconds);
  if (factor === null) throw new TimelineError(`Para caber em ${targetSeconds} s a velocidade mudaria demais (de ${current.toFixed(1)} s, o limite é entre 0,5× e 2×)`, 'OUT_OF_RANGE');
  assertUnlocked(found[0]!.track);
  // Os clipes ficam em sequência a partir do início do primeiro; cada um muda de velocidade e de duração ao mesmo tempo
  // (o trecho de origem usado continua o mesmo). Tudo é validado de uma vez, sem passar por estados intermediários.
  const sorted = found.map((f) => f.clip as MediaClip).sort((a, b) => a.start - b.start);
  let cursor = sorted[0]!.start;
  const updated = new Map<string, MediaClip>();
  for (const c of sorted) {
    const duration = round6(c.duration / factor);
    const speed = round6(c.speed * factor);
    if (speed < 0.1 || speed > 16) throw new TimelineError('A velocidade resultante ficaria fora do limite do editor (0,1× a 16×)', 'OUT_OF_RANGE');
    updated.set(c.id, { ...c, speed, duration, start: round6(cursor) });
    cursor = round6(cursor + duration);
  }
  const next = withTrackClips(p, trackId, (cs) => cs.map((c) => updated.get(c.id) ?? c));
  for (const c of updated.values()) assertSourceRange(next, c);
  assertTracksValid(next, [trackId]);
  return { project: next, factor };
}
