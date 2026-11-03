import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { rampResultDuration, rampSpeeds, speedRamp } from './creative';

describe('rampSpeeds', () => {
  it('linear: usa o centro de cada trecho e é uma progressão aritmética', () => {
    const v = rampSpeeds(1, 3, 4);
    expect(v).toEqual([1.25, 1.75, 2.25, 2.75]);
    expect(v[1]! - v[0]!).toBeCloseTo(v[3]! - v[2]!, 6);
  });

  it('suave: começa mais devagar e termina mais devagar que a linear, e é simétrica em torno do meio', () => {
    const lin = rampSpeeds(1, 4, 6);
    const smooth = rampSpeeds(1, 4, 6, true);
    expect(smooth[0]!).toBeLessThan(lin[0]!);
    expect(smooth[5]!).toBeGreaterThan(lin[5]!);
    expect(smooth[0]! + smooth[5]!).toBeCloseTo(5, 5); // from + to
    expect(smooth[1]! + smooth[4]!).toBeCloseTo(5, 5);
  });

  it('de rápido para lento também funciona (decrescente)', () => {
    const v = rampSpeeds(4, 1, 5);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
});

describe('rampResultDuration', () => {
  it('velocidade constante 2× em 4 s de mídia dá 2 s; 0,5× dá 8 s', () => {
    expect(rampResultDuration(4, [2, 2, 2, 2])).toBe(2);
    expect(rampResultDuration(4, [0.5, 0.5])).toBe(8);
    expect(rampResultDuration(4, [])).toBe(0);
  });

  it('bate exatamente com o que speedRamp produz na timeline', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4);
    const p = addClip(project, trackId, c);
    const r = speedRamp(p, c.id, { from: 0.5, to: 2, parts: 5, smooth: true });
    const total = r.ids.reduce((n, id) => n + (findClip(r.project, id)!.clip as MediaClip).duration, 0);
    expect(total).toBeCloseTo(rampResultDuration(4, rampSpeeds(0.5, 2, 5, true)), 4);
  });
});
