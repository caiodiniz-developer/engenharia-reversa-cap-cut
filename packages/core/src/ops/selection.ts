import { TimelineError } from '../errors';
import { allClips } from '../project';
import type { Clip, Project, Track } from '../schema';

export const SELECT_CRITERIA = ['muted', 'effects', 'keyframes', 'transition', 'linked', 'grouped', 'speed', 'reversed', 'shorter', 'longer'] as const;
export type SelectCriterion = (typeof SELECT_CRITERIA)[number];

const hasKeyframes = (c: Clip) => Object.values(c.keyframes).some((k) => k && k.length > 0);

function matches(c: Clip, t: Track, criterion: SelectCriterion, seconds: number): boolean {
  switch (criterion) {
    case 'muted':
      return c.type === 'media' && (c.audio.muted || t.muted);
    case 'effects':
      return c.type === 'media' && c.effects.length > 0;
    case 'keyframes':
      return hasKeyframes(c);
    case 'transition':
      return c.type === 'media' && !!c.transitionIn;
    case 'linked':
      return !!c.linkId;
    case 'grouped':
      return !!c.groupId;
    case 'speed':
      return c.type === 'media' && Math.abs(c.speed - 1) > 1e-6;
    case 'reversed':
      return c.type === 'media' && c.reverse;
    case 'shorter':
      return c.duration < seconds - 1e-9;
    case 'longer':
      return c.duration > seconds + 1e-9;
  }
}

/** Ids dos clipes (em faixas desbloqueadas) que atendem ao critério. "shorter" e "longer" pedem uma duração em segundos. */
export function selectWhere(p: Project, criterion: SelectCriterion, seconds = 0): string[] {
  if ((criterion === 'shorter' || criterion === 'longer') && !(seconds > 0)) throw new TimelineError('Informe uma duração maior que zero', 'OUT_OF_RANGE');
  return allClips(p)
    .filter(({ clip, track }) => !track.locked && matches(clip, track, criterion, seconds))
    .map(({ clip }) => clip.id);
}

/** Inverte a seleção: todos os clipes de faixas desbloqueadas que não estavam em ${ids}. */
export function invertIds(p: Project, ids: Iterable<string>): string[] {
  const chosen = new Set(ids);
  return allClips(p)
    .filter(({ clip, track }) => !track.locked && !chosen.has(clip.id))
    .map(({ clip }) => clip.id);
}
