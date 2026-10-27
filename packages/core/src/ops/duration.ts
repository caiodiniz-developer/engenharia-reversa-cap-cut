import { TimelineError } from '../errors';
import type { Project } from '../schema';
import { round6 } from '../time';
import { trimClip } from './clips';
import { requireClip } from './helpers';

/**
 * Dá a mesma duração (segundos) a todos os clipes escolhidos, mantendo o início de cada um.
 * Vale para imagens, textos, legendas e vídeos/áudios que ainda têm mídia sobrando; falha se a mídia não alcança
 * ou se o clipe bateria no seguinte. Nada é alterado quando algum clipe falha (a operação é atômica).
 */
export function setClipsDuration(p: Project, ids: string[], seconds: number): Project {
  if (!(seconds > 0) || !Number.isFinite(seconds)) throw new TimelineError('A duração precisa ser maior que zero', 'OUT_OF_RANGE');
  let next = p;
  for (const id of new Set(ids)) {
    const { clip } = requireClip(next, id);
    next = trimClip(next, id, 'end', round6(clip.start + seconds));
  }
  return next;
}
