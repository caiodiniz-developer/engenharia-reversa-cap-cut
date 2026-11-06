import { beforeEach, describe, expect, it } from 'vitest';
import { ACCENTS, ACCENT_LABEL, applyAppearance, loadAccent, loadGlass, saveAppearance } from './appearance';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.accent;
  delete document.documentElement.dataset.glass;
});

describe('aparência', () => {
  it('os padrões são verde-água e vidro', () => {
    expect(loadAccent()).toBe('teal');
    expect(loadGlass()).toBe('glass');
  });

  it('guarda e lê cada cor; valores desconhecidos voltam ao padrão', () => {
    for (const a of ACCENTS) {
      saveAppearance(a, 'solid');
      expect(loadAccent()).toBe(a);
      expect(loadGlass()).toBe('solid');
    }
    localStorage.setItem('editor.accent', 'neon');
    localStorage.setItem('editor.glass', 'talvez');
    expect(loadAccent()).toBe('teal');
    expect(loadGlass()).toBe('glass');
  });

  it('aplica os atributos no html: verde-água e vidro não deixam atributo', () => {
    applyAppearance('blue', 'solid');
    expect(document.documentElement.dataset.accent).toBe('blue');
    expect(document.documentElement.dataset.glass).toBe('solid');
    applyAppearance('teal', 'glass');
    expect(document.documentElement.dataset.accent).toBeUndefined();
    expect(document.documentElement.dataset.glass).toBeUndefined();
  });

  it('toda cor tem nome em português', () => {
    for (const a of ACCENTS) expect(ACCENT_LABEL[a].length).toBeGreaterThan(2);
  });
});
