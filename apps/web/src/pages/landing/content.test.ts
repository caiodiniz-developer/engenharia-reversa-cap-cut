import { describe, expect, it } from 'vitest';
import { EFFECTS, PLATFORMS } from '@editor/core';
import { DIFFERENTIALS, FAQ, FEATURES, HERO, liveStats, NAV, STEPS } from './content';

describe('conteúdo da landing page', () => {
  it('a navegação aponta para seções com ids únicos', () => {
    expect(new Set(NAV.map((n) => n.id)).size).toBe(NAV.length);
    for (const n of NAV) expect(n.id).toMatch(/^[a-z-]+$/);
  });

  it('recursos e diferenciais têm título, texto e ícone, sem repetir títulos', () => {
    for (const list of [FEATURES, DIFFERENTIALS]) {
      expect(list.length).toBeGreaterThanOrEqual(6);
      expect(new Set(list.map((f) => f.title)).size).toBe(list.length);
      for (const f of list) {
        expect(f.title.length).toBeGreaterThan(3);
        expect(f.text.length).toBeGreaterThan(30);
        expect(f.icon).toBeTruthy();
      }
    }
  });

  it('passos numerados em sequência e perguntas com resposta', () => {
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(FAQ.length).toBeGreaterThanOrEqual(5);
    for (const f of FAQ) {
      expect(f.q.endsWith('?')).toBe(true);
      expect(f.a.length).toBeGreaterThan(30);
    }
  });

  it('os números da landing vêm do código do editor e são todos positivos', () => {
    const stats = liveStats();
    expect(stats.find((s) => s.label === 'efeitos de imagem')!.value).toBe(String(EFFECTS.length));
    expect(stats.find((s) => s.label === 'plataformas de destino')!.value).toBe(String(PLATFORMS.length));
    for (const s of stats) expect(Number(s.value)).toBeGreaterThan(0);
  });

  it('o texto principal não promete o que o produto não faz', () => {
    const all = [HERO.title, HERO.subtitle, HERO.note, ...FEATURES.map((f) => f.text), ...DIFFERENTIALS.map((f) => f.text)].join(' ').toLowerCase();
    for (const banned of ['grátis', 'gratuito', 'ilimitado', 'sem limites', 'melhor do mundo', 'garantido']) expect(all, banned).not.toContain(banned);
  });
});
