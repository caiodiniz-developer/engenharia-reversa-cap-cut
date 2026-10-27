import type { Shortcut } from './useShortcuts';

export const SHORTCUT_CATEGORIES = ['Reprodução', 'Edição', 'Timeline', 'Seleção', 'Projeto e interface'] as const;
export type ShortcutCategory = (typeof SHORTCUT_CATEGORIES)[number];

/** Categoria de cada atalho (chave = texto exato de `keys`). Atalho novo sem categoria quebra o teste de cobertura. */
export const CATEGORY_OF: Record<string, ShortcutCategory> = {
  Espaço: 'Reprodução',
  '← / →': 'Reprodução',
  'Shift + ← / →': 'Reprodução',
  '[ / ]': 'Reprodução',
  'Home / End': 'Reprodução',
  '↑ / ↓': 'Reprodução',
  'I / O': 'Reprodução',
  S: 'Edição',
  Delete: 'Edição',
  'Shift + Delete': 'Edição',
  'Ctrl + Z': 'Edição',
  'Ctrl + Shift + Z  /  Ctrl + Y': 'Edição',
  'Ctrl + C  /  Ctrl + V': 'Edição',
  'Ctrl + D': 'Edição',
  'Ctrl + Alt + C  /  Ctrl + Alt + V': 'Edição',
  'Q / W': 'Edição',
  'Alt + ← / →': 'Edição',
  'Shift + R': 'Edição',
  'Ctrl + A': 'Seleção',
  'Ctrl + G  /  Ctrl + Shift + G': 'Seleção',
  M: 'Timeline',
  N: 'Timeline',
  '+ / −': 'Timeline',
  'Shift + Z': 'Timeline',
  'Shift + F': 'Timeline',
  'Ctrl + roda do mouse': 'Timeline',
  'Alt ao arrastar': 'Timeline',
  'Ctrl + S': 'Projeto e interface',
  'Ctrl + K': 'Projeto e interface',
  F: 'Projeto e interface',
  Esc: 'Seleção',
  '?': 'Projeto e interface',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface ShortcutGroup {
  category: ShortcutCategory;
  items: Shortcut[];
}

/** Agrupa por categoria (na ordem fixa) e filtra por texto no nome, nas teclas ou no nome da categoria, sem acento. Categorias vazias somem. */
export function groupShortcuts(list: Shortcut[], query = ''): ShortcutGroup[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  return SHORTCUT_CATEGORIES.map((category) => ({
    category,
    items: list.filter((s) => {
      if ((CATEGORY_OF[s.keys] ?? 'Projeto e interface') !== category) return false;
      const hay = norm(s.label) + ' ' + norm(s.keys) + ' ' + norm(category);
      return terms.every((t) => hay.includes(t));
    }),
  })).filter((g) => g.items.length > 0);
}

/** Separa "Ctrl + C  /  Ctrl + V" em ["Ctrl + C", "Ctrl + V"] para desenhar uma tecla por vez. */
export function splitKeyCombos(keys: string): string[] {
  return keys.split(/\s{2}\/\s{2}/).map((k) => k.trim());
}
