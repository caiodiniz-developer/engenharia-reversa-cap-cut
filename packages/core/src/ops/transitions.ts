import type { Project, TransitionType } from '../schema';
import { TimelineError } from '../errors';
import { removeTransition, setTransition } from './advanced';
import { sequenceOrder } from './reorder';

/**
 * Aplica a mesma transição em todos os cortes da faixa (entre clipes de mídia encostados). Cortes com vão, de textos
 * ou curtos demais para a duração pedida ficam sem transição e são contados em skipped.
 */
export function setTransitionsOnTrack(p: Project, trackId: string, type: TransitionType, duration: number): { project: Project; applied: number; skipped: number } {
  let next = p;
  let applied = 0;
  let skipped = 0;
  const count = sequenceOrder(p, trackId).length;
  for (let i = 1; i < count; i++) {
    const clip = sequenceOrder(next, trackId)[i]!;
    try {
      next = setTransition(next, clip.id, type, duration);
      applied++;
    } catch (e) {
      if (!(e instanceof TimelineError)) throw e;
      skipped++;
    }
  }
  return { project: next, applied, skipped };
}

/** Tira todas as transições da faixa, devolvendo os clipes à posição sem sobreposição. */
export function removeTransitionsOnTrack(p: Project, trackId: string): { project: Project; removed: number } {
  const ids = sequenceOrder(p, trackId)
    .filter((c) => c.type === 'media' && c.transitionIn)
    .map((c) => c.id);
  let next = p;
  for (const id of ids) next = removeTransition(next, id);
  return { project: next, removed: ids.length };
}
