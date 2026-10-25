import { describe, expect, it } from 'vitest';
import { ANIMATION_PRESETS, applyAnimation, clearAnimations } from './animation';
import { evaluateKeyframes } from './keyframes';
import { mediaClip } from './testing';
import type { MediaClip } from './schema';

const clip = (d = 6): MediaClip => mediaClip('m1', 0, d);

describe('animações prontas', () => {
  it('todas as animações geram keyframes válidos, ordenados e dentro do clipe', () => {
    for (const p of ANIMATION_PRESETS) {
      const out = applyAnimation(clip(), p.id);
      for (const prop of p.props) {
        const kfs = out.keyframes[prop];
        expect(kfs?.length, `${p.id}.${prop}`).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < kfs!.length; i++) expect(kfs![i]!.time).toBeGreaterThanOrEqual(kfs![i - 1]!.time);
        expect(kfs!.every((k) => k.time >= 0 && k.time <= 6 + 1e-6 && Number.isFinite(k.value))).toBe(true);
      }
    }
  });

  it('entrada: começa transparente e termina visível no tempo certo', () => {
    const c = applyAnimation(clip(), 'fade-in', 1);
    expect(evaluateKeyframes(c.keyframes.opacity, 0, 1)).toBe(0);
    expect(evaluateKeyframes(c.keyframes.opacity, 0.5, 1)).toBeCloseTo(0.5, 5);
    expect(evaluateKeyframes(c.keyframes.opacity, 1, 1)).toBe(1);
    expect(evaluateKeyframes(c.keyframes.opacity, 5, 1)).toBe(1);
  });

  it('entrada + saída convivem na mesma propriedade', () => {
    let c = applyAnimation(clip(6), 'fade-in', 1);
    c = applyAnimation(c, 'fade-out', 1);
    const f = (t: number) => evaluateKeyframes(c.keyframes.opacity, t, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(3)).toBe(1);
    expect(f(5.5)).toBeCloseTo(0.5, 5);
    expect(f(6)).toBe(0);
    expect(c.keyframes.opacity).toHaveLength(4);
  });

  it('reaplicar a mesma entrada substitui em vez de acumular', () => {
    let c = applyAnimation(clip(), 'fade-in', 1);
    c = applyAnimation(c, 'fade-in', 2);
    expect(c.keyframes.opacity).toHaveLength(2);
    expect(c.keyframes.opacity![1]!.time).toBe(2);
  });

  it('a duração é limitada à metade do clipe', () => {
    const c = applyAnimation(clip(2), 'fade-in', 10);
    expect(c.keyframes.opacity![1]!.time).toBe(1);
  });

  it('animações de clipe inteiro substituem e podem alterar a escala fixa', () => {
    const c = applyAnimation(clip(4), 'pan-left');
    expect(c.transform.scale).toBe(1.15);
    expect(evaluateKeyframes(c.keyframes.x, 0, 0)).toBeCloseTo(0.06, 5);
    expect(evaluateKeyframes(c.keyframes.x, 4, 0)).toBeCloseTo(-0.06, 5);
    const k = applyAnimation(clip(4), 'ken-burns-in');
    expect(evaluateKeyframes(k.keyframes.scale, 2, 1)).toBeCloseTo(1.1, 3);
  });

  it('tremer é determinístico (mesma entrada, mesma saída)', () => {
    const a = applyAnimation(clip(2), 'shake');
    const b = applyAnimation(clip(2), 'shake');
    expect(a.keyframes).toEqual(b.keyframes);
  });

  it('limpar remove todos os keyframes e animação desconhecida é recusada', () => {
    const c = clearAnimations(applyAnimation(clip(), 'pop'));
    expect(c.keyframes).toEqual({});
    expect(() => applyAnimation(clip(), 'nao-existe')).toThrow(/desconhecida/);
  });
});
