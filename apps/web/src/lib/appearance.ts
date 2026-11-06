export const ACCENTS = ['teal', 'blue', 'violet', 'orange', 'pink'] as const;
export type Accent = (typeof ACCENTS)[number];
export type GlassMode = 'glass' | 'solid';

export const ACCENT_LABEL: Record<Accent, string> = { teal: 'Verde-água', blue: 'Azul', violet: 'Violeta', orange: 'Laranja', pink: 'Rosa' };

const ACCENT_KEY = 'editor.accent';
const GLASS_KEY = 'editor.glass';

export function loadAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return (ACCENTS as readonly string[]).includes(v ?? '') ? (v as Accent) : 'teal';
  } catch {
    return 'teal';
  }
}

export function loadGlass(): GlassMode {
  try {
    return localStorage.getItem(GLASS_KEY) === 'solid' ? 'solid' : 'glass';
  } catch {
    return 'glass';
  }
}

/** Aplica no <html>: o verde-água é o padrão (sem atributo); o vidro sólido liga data-glass="solid". */
export function applyAppearance(accent: Accent, glass: GlassMode, root: HTMLElement = document.documentElement): void {
  if (accent === 'teal') delete root.dataset.accent;
  else root.dataset.accent = accent;
  if (glass === 'solid') root.dataset.glass = 'solid';
  else delete root.dataset.glass;
}

export function saveAppearance(accent: Accent, glass: GlassMode): void {
  try {
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem(GLASS_KEY, glass);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
