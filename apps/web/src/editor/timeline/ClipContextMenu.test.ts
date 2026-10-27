import { describe, expect, it } from 'vitest';
import { buildCommands } from '../commands';
import { CLIP_MENU_GROUPS, clipMenuItems } from './ClipContextMenu';

describe('menu de contexto do clipe', () => {
  it('todos os ids do menu existem na paleta (nenhum item some em silêncio)', () => {
    const ids = new Set(buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} }).map((c) => c.id));
    for (const id of CLIP_MENU_GROUPS.flat()) expect(ids.has(id), id).toBe(true);
  });

  it('mantém os grupos na ordem e sem itens repetidos', () => {
    const groups = clipMenuItems();
    expect(groups.length).toBe(CLIP_MENU_GROUPS.length);
    const flat = groups.flat().map((c) => c.id);
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat[0]).toBe('split');
  });
});
