import { create } from 'zustand';

export type Theme = 'dark' | 'light';
const KEY = 'editor.theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return 'dark';
}

export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
}

interface ThemeState {
  theme: Theme;
  setTheme(t: Theme): void;
  toggle(): void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial(),
  setTheme(t) {
    applyTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignora */
    }
    set({ theme: t });
  },
  toggle() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));

// Aplica antes da primeira renderização para não "piscar" no tema errado.
applyTheme(useTheme.getState().theme);
