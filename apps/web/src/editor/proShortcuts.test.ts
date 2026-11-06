import { describe, expect, it } from 'vitest';
import { buildCreativeCommands } from './creativeCommands';
import { buildProCommands } from './proCommands';
import { CATEGORY_OF } from './shortcutGroups';
import { SHORTCUTS } from './shortcuts';

describe('atalhos da edição profissional', () => {
  const all = [...buildCreativeCommands(), ...buildProCommands()];

  it('estão na lista de atalhos e em uma categoria', () => {
    for (const keys of ['Alt + J', 'Alt + L', 'Alt + H']) {
      expect(SHORTCUTS.some((x) => x.keys === keys), keys).toBe(true);
      expect(CATEGORY_OF[keys], keys).toBe('Edição');
    }
  });

  it('cada tecla aponta para um comando real que mostra o mesmo atalho', () => {
    const wanted = { 'jcut-1': 'Alt+J', 'lcut-1': 'Alt+L', 'hold-last-2': 'Alt+H' } as const;
    for (const [id, shortcut] of Object.entries(wanted)) expect(all.find((c) => c.id === id)?.shortcut, id).toBe(shortcut);
  });

  it('nenhum atalho aparece em dois comandos', () => {
    const used = all.filter((c) => c.shortcut).map((c) => c.shortcut);
    expect(new Set(used).size).toBe(used.length);
  });
});
