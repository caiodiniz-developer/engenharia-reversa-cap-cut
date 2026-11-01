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

/**
 * Substitui a mídia ${fromId} por ${toId} em todos os clipes da timeline, mantendo posição, efeitos e ajustes.
 * Os dois precisam ser do mesmo tipo e a nova mídia precisa cobrir o trecho que cada clipe usa.
 */
export function replaceMedia(p: Project, fromId: string, toId: string): { project: Project; replaced: number } {
  const from = p.media[fromId];
  const to = p.media[toId];
  if (!from || !to) throw new TimelineError('Mídia não encontrada', 'NOT_FOUND');
  if (fromId === toId) throw new TimelineError('Escolha uma mídia diferente', 'INVALID');
  if (from.kind !== to.kind) throw new TimelineError('A nova mídia precisa ser do mesmo tipo (vídeo, imagem ou áudio)', 'KIND_MISMATCH');
  const targets = allClips(p).filter(({ clip }) => clip.type === 'media' && clip.mediaId === fromId);
  if (!targets.length) throw new TimelineError('Essa mídia não está sendo usada na timeline', 'NOT_FOUND');
  let next = p;
  for (const { clip } of targets) next = updateClip(next, clip.id, (c) => ({ ...c, mediaId: toId }) as typeof c);
  return { project: next, replaced: targets.length };
}
