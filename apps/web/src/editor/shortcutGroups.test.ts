import { describe, expect, it } from 'vitest';
import { CATEGORY_OF, groupShortcuts, SHORTCUT_CATEGORIES, splitKeyCombos } from './shortcutGroups';
import { SHORTCUTS } from './useShortcuts';

describe('atalhos agrupados', () => {
  it('todo atalho listado tem categoria definida (atalho novo precisa ser classificado)', () => {
    const missing = SHORTCUTS.filter((s) => !(s.keys in CATEGORY_OF)).map((s) => s.keys);
    expect(missing).toEqual([]);
  });

  it('nenhuma categoria do mapa é inventada', () => {
    for (const c of Object.values(CATEGORY_OF)) expect(SHORTCUT_CATEGORIES).toContain(c);
  });

  it('sem busca mostra todos os atalhos, na ordem fixa das categorias', () => {
    const groups = groupShortcuts(SHORTCUTS);
    expect(groups.flatMap((g) => g.items)).toHaveLength(SHORTCUTS.length);
    const order = groups.map((g) => SHORTCUT_CATEGORIES.indexOf(g.category));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('a busca ignora acento e maiúsculas e olha o nome, as teclas e a categoria', () => {
    const byName = groupShortcuts(SHORTCUTS, 'PAUSAR').flatMap((g) => g.items.map((i) => i.keys));
    expect(byName).toEqual(['Espaço']);
    const byCategory = groupShortcuts(SHORTCUTS, 'reproducao');
    expect(byCategory.find((g) => g.category === 'Reprodução')!.items.map((i) => i.keys)).toContain('Home / End');
    const byKeys = groupShortcuts(SHORTCUTS, 'ctrl k').flatMap((g) => g.items.map((i) => i.keys));
    expect(byKeys).toContain('Ctrl + K');
    expect(byKeys).not.toContain('Espaço');
  });

  it('busca sem resultado devolve lista vazia e categorias vazias não aparecem', () => {
    expect(groupShortcuts(SHORTCUTS, 'zzzzzz')).toEqual([]);
    const g = groupShortcuts(SHORTCUTS, 'foco');
    expect(g).toHaveLength(1);
    expect(g[0]!.category).toBe('Projeto e interface');
  });
});

describe('splitKeyCombos', () => {
  it('separa combinações alternativas', () => {
    expect(splitKeyCombos('Ctrl + C  /  Ctrl + V')).toEqual(['Ctrl + C', 'Ctrl + V']);
    expect(splitKeyCombos('← / →')).toEqual(['← / →']);
    expect(splitKeyCombos('Espaço')).toEqual(['Espaço']);
  });
});
