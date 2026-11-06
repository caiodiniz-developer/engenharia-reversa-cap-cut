export const ACCENTS = ['teal', 'blue', 'violet', 'orange', 'pink'] as const;
export type Accent = (typeof ACCENTS)[number];
/** 'glass' = sempre vidro (padrão); 'auto' = respeita "reduzir transparência" do sistema; 'solid' = sempre sólido. */
export type GlassMode = 'glass' | 'auto' | 'solid';
export const GLASS_LABEL: Record<GlassMode, string> = { glass: 'Vidro sempre ligado', auto: 'Seguir o sistema (reduzir transparência)', solid: 'Superfícies sólidas' };

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
    const v = localStorage.getItem(GLASS_KEY);
    return v === 'solid' || v === 'auto' ? v : 'glass';
  } catch {
    return 'glass';
  }
}

/** Aplica no <html>: o verde-água é o padrão (sem atributo); o vidro sólido liga data-glass="solid". */
export function applyAppearance(accent: Accent, glass: GlassMode, root: HTMLElement = document.documentElement): void {
  if (accent === 'teal') delete root.dataset.accent;
  else root.dataset.accent = accent;
  if (glass === 'glass') delete root.dataset.glass;
  else root.dataset.glass = glass;
}

export function saveAppearance(accent: Accent, glass: GlassMode): void {
  try {
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem(GLASS_KEY, glass);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
