import { TimelineError } from '../errors';
import { allClips } from '../project';
import type { Project } from '../schema';
import { deleteClips, updateClip } from './clips';

/** Grupos de clipes de mídia idênticos (mesma mídia, mesmo trecho de origem, mesma velocidade, mesmo início e duração). */
export function findDuplicateClips(p: Project): string[][] {
  const groups = new Map<string, string[]>();
  for (const { clip } of allClips(p)) {
    if (clip.type !== 'media') continue;
    const key = [clip.mediaId, clip.sourceIn.toFixed(3), clip.speed, clip.start.toFixed(3), clip.duration.toFixed(3)].join('|');
    groups.set(key, [...(groups.get(key) ?? []), clip.id]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Apaga as cópias idênticas e mantém o primeiro clipe de cada grupo. Devolve quantas apagou. */
export function removeDuplicateClips(p: Project): { project: Project; removed: number } {
  const extra = findDuplicateClips(p).flatMap((g) => g.slice(1));
  if (!extra.length) return { project: p, removed: 0 };
  return { project: deleteClips(p, extra, { ripple: false }), removed: extra.length };
}
