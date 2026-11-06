const KEY = 'editor.palette.favorites';
export const MAX_FAVORITES = 12;

/** Adiciona (no começo) ou retira o comando dos favoritos; passando do limite, o mais antigo sai. */
export function toggleFavorite(list: string[], id: string, max = MAX_FAVORITES): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, max);
}

/** Favoritos no começo, na ordem em que foram favoritados; o resto mantém a ordem que já tinha. */
export function withFavoritesFirst<T extends { id: string }>(items: T[], favorites: string[]): T[] {
  const rank = new Map(favorites.map((id, i) => [id, i]));
  const fav = items.filter((i) => rank.has(i.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...fav, ...items.filter((i) => !rank.has(i.id))];
}

export function loadFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_FAVORITES) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_FAVORITES)));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
