const KEY = 'editor.palette.recent';
export const MAX_RECENT = 6;

/** Coloca `id` no topo da lista (sem repetir) e mantém no máximo `max` itens. */
export function pushRecent(list: string[], id: string, max = MAX_RECENT): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Move os comandos usados recentemente para o início, na ordem do mais recente; o resto mantém a ordem original. */
export function withRecentFirst<T extends { id: string }>(items: T[], recent: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const head = [...new Set(recent)].map((id) => byId.get(id)).filter((i): i is T => !!i);
  const seen = new Set(head.map((i) => i.id));
  return [...head, ...items.filter((i) => !seen.has(i.id))];
}

export function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* sem armazenamento: o recurso é opcional */
  }
}
