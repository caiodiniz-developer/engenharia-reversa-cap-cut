import { describe, expect, it } from 'vitest';
import { CATEGORY_OF } from './shortcutGroups';
import { buildCreativeCommands } from './creativeCommands';
import { SHORTCUTS } from './useShortcuts';

describe('atalhos dos comandos criativos', () => {
  const list = buildCreativeCommands();

  it('Alt+I, Alt+B e Alt+R estão na lista de atalhos e em uma categoria', () => {
    for (const keys of ['Alt + I', 'Alt + B', 'Alt + R']) {
      expect(SHORTCUTS.some((x) => x.keys === keys), keys).toBe(true);
      expect(CATEGORY_OF[keys], keys).toBeDefined();
    }
  });

  it('cada tecla aponta para um comando real, que mostra o mesmo atalho na paleta', () => {
    const wanted = { 'select-invert': 'Alt+I', boomerang: 'Alt+B', 'ramp-custom': 'Alt+R' } as const;
    for (const [id, shortcut] of Object.entries(wanted)) expect(list.find((c) => c.id === id)?.shortcut, id).toBe(shortcut);
  });

  it('nenhum atalho aparece em dois comandos', () => {
    const used = list.filter((c) => c.shortcut).map((c) => c.shortcut);
    expect(new Set(used).size).toBe(used.length);
  });
});
