import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { fitClipsToDuration, fitFactor } from './fit';
import type { MediaClip } from '../schema';

describe('fitFactor', () => {
  it('fator = atual ÷ alvo; null fora de 0,5×–2×', () => {
    expect(fitFactor(10, 5)).toBe(2);
    expect(fitFactor(10, 20)).toBe(0.5);
    expect(fitFactor(10, 8)).toBe(1.25);
    expect(fitFactor(10, 4)).toBeNull();
    expect(fitFactor(10, 25)).toBeNull();
    expect(fitFactor(0, 5)).toBeNull();
    expect(fitFactor(5, 0)).toBeNull();
  });
});

describe('fitClipsToDuration', () => {
  function two() {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 4);
    const b = mediaClip('m1', 4, 6);
    return { p: addClip(addClip(project, trackId, a), trackId, b), a, b };
  }

  it('acelera todos pelo mesmo fator e a sequência fecha exatamente na duração-alvo', () => {
    const { p, a, b } = two(); // 10 s
    const { project, factor } = fitClipsToDuration(p, [a.id, b.id], 8);
    expect(factor).toBe(1.25);
    expect(findClip(project, a.id)!.clip).toMatchObject({ speed: 1.25, start: 0, duration: 3.2 });
    expect(findClip(project, b.id)!.clip).toMatchObject({ speed: 1.25, start: 3.2, duration: 4.8 });
  });

  it('câmera lenta: alvo maior reduz a velocidade', () => {
    const { p, a, b } = two();
    const { project } = fitClipsToDuration(p, [a.id, b.id], 15);
    expect((findClip(project, a.id)!.clip as MediaClip).speed).toBeCloseTo(0.6667, 3);
    expect(findClip(project, b.id)!.clip.start + findClip(project, b.id)!.clip.duration).toBeCloseTo(15, 3);
  });

  it('multiplica a velocidade que o clipe já tinha', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4, { speed: 2 });
    const p = addClip(project, trackId, c);
    const { project: out } = fitClipsToDuration(p, [c.id], 2);
    expect((findClip(out, c.id)!.clip as MediaClip).speed).toBe(4);
  });

  it('recusa quando a velocidade final passaria de 16×', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4, { speed: 10 });
    const p = addClip(project, trackId, c);
    expect(() => fitClipsToDuration(p, [c.id], 2)).toThrow(/limite/);
  });

  it('recusa fator fora do limite, faixas diferentes e clipes que não são de mídia', () => {
    const { p, a, b } = two();
    expect(() => fitClipsToDuration(p, [a.id, b.id], 2)).toThrow(/mudaria demais/);
    expect(() => fitClipsToDuration(p, [], 5)).toThrow();
    expect(() => fitClipsToDuration(p, [a.id, b.id], -1)).toThrow();
  });
});
