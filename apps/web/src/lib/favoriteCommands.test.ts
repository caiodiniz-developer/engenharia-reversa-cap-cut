import { beforeEach, describe, expect, it } from 'vitest';
import { withRecentFirst } from './recentCommands';
import { MAX_FAVORITES, loadFavorites, saveFavorites, toggleFavorite, withFavoritesFirst } from './favoriteCommands';

beforeEach(() => localStorage.clear());

describe('toggleFavorite', () => {
  it('favorita pela frente e desfavorita se já era', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a']);
    expect(toggleFavorite(['b', 'a'], 'a')).toEqual(['b']);
  });

  it('respeita o limite: o mais antigo sai', () => {
    let l: string[] = [];
    for (let i = 0; i < MAX_FAVORITES + 2; i++) l = toggleFavorite(l, 'c' + i);
    expect(l).toHaveLength(MAX_FAVORITES);
    expect(l[0]).toBe('c' + (MAX_FAVORITES + 1));
    expect(l).not.toContain('c0');
  });
});

describe('withFavoritesFirst', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  it('favoritos primeiro, na ordem de favoritar; o resto na ordem original', () => {
    expect(withFavoritesFirst(items, ['c', 'a']).map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ids desconhecidos são ignorados e sem favoritos nada muda', () => {
    expect(withFavoritesFirst(items, ['zzz']).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(withFavoritesFirst(items, [])).toEqual(items);
  });

  it('em cima dos recentes: favoritos, depois recentes, depois o resto', () => {
    const ordered = withFavoritesFirst(withRecentFirst(items, ['d', 'b']), ['c']);
    expect(ordered.map((i) => i.id)).toEqual(['c', 'd', 'b', 'a']);
  });
});

describe('armazenamento', () => {
  it('guarda e lê; lixo vira lista válida sem repetidos', () => {
    saveFavorites(['x', 'y']);
    expect(loadFavorites()).toEqual(['x', 'y']);
    localStorage.setItem('editor.palette.favorites', '["a", 1, "a", null, "b"]');
    expect(loadFavorites()).toEqual(['a', 'b']);
    localStorage.setItem('editor.palette.favorites', '{ruim');
    expect(loadFavorites()).toEqual([]);
  });
});
