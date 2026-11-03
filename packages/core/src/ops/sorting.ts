import { applySequenceOrder } from './arrange2';
import { sequenceOrder } from './reorder';
import type { Project } from '../schema';

export type SortBy = 'duration-asc' | 'duration-desc' | 'name';

/** Reordena os clipes da faixa: do mais curto ao mais longo, ao contrário, ou por nome (da mídia, do texto ou da legenda), sem perder os vãos. */
export function sortSequence(p: Project, trackId: string, by: SortBy): Project {
  const label = (c: ReturnType<typeof sequenceOrder>[number]) => (c.type === 'media' ? (p.media[c.mediaId]?.name ?? '') : c.text);
  const items = sequenceOrder(p, trackId);
  const sorted = [...items].sort((a, b) => {
    if (by === 'name') return label(a).localeCompare(label(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    return by === 'duration-asc' ? a.duration - b.duration : b.duration - a.duration;
  });
  return applySequenceOrder(p, trackId, sorted.map((c) => c.id));
}
