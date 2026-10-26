import type { MediaItem } from '../api/types';

export type MediaSort = 'name' | 'duration' | 'size' | 'unused';

export const MEDIA_SORT_LABEL: Record<MediaSort, string> = {
  name: 'Nome (A–Z)',
  duration: 'Mais longas primeiro',
  size: 'Maiores primeiro',
  unused: 'Não usadas primeiro',
};

const byName = (a: MediaItem, b: MediaItem) => a.name.localeCompare(b.name, 'pt', { numeric: true });

/** Ordena a biblioteca sem alterar o array de entrada. Empates sempre se desfazem pelo nome. */
export function sortMedia(items: MediaItem[], key: MediaSort, used: ReadonlySet<string> = new Set()): MediaItem[] {
  const list = [...items];
  switch (key) {
    case 'name':
      return list.sort(byName);
    case 'duration':
      return list.sort((a, b) => b.duration - a.duration || byName(a, b));
    case 'size':
      return list.sort((a, b) => b.size - a.size || byName(a, b));
    case 'unused':
      return list.sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)) || byName(a, b));
  }
}
