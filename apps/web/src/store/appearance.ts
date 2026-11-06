import { create } from 'zustand';
import { applyAppearance, loadAccent, loadGlass, saveAppearance, type Accent, type GlassMode } from '../lib/appearance';

interface AppearanceState {
  accent: Accent;
  glass: GlassMode;
  setAccent(a: Accent): void;
  toggleGlass(): void;
}

export const useAppearance = create<AppearanceState>((set, get) => ({
  accent: loadAccent(),
  glass: loadGlass(),
  setAccent(accent) {
    applyAppearance(accent, get().glass);
    saveAppearance(accent, get().glass);
    set({ accent });
  },
  toggleGlass() {
    const glass: GlassMode = get().glass === 'glass' ? 'solid' : 'glass';
    applyAppearance(get().accent, glass);
    saveAppearance(get().accent, glass);
    set({ glass });
  },
}));

// Aplica antes da primeira renderização para não "piscar" na cor errada.
applyAppearance(useAppearance.getState().accent, useAppearance.getState().glass);
