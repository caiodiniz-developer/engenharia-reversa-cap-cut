import { describe, expect, it } from 'vitest';
import { MediaClipSchema, type MediaClip } from '@editor/core';
import { rangeToTimeline, sourceToTimeline } from './timemap';

const clip = (extra: Partial<MediaClip>): MediaClip => MediaClipSchema.parse({ id: 'c', type: 'media', mediaId: 'm', start: 10, duration: 4, sourceIn: 2, ...extra });

describe('mapeamento mídia → timeline', () => {
  it('velocidade normal', () => {
    const c = clip({});
    expect(sourceToTimeline(c, 2)).toBe(10);
    expect(sourceToTimeline(c, 4)).toBe(12);
    expect(rangeToTimeline(c, { start: 3, end: 4 })).toEqual({ start: 11, end: 12 });
  });

  it('recorta ao trecho usado e ignora o que está fora', () => {
    const c = clip({});
    expect(rangeToTimeline(c, { start: 0, end: 3 })).toEqual({ start: 10, end: 11 });
    expect(rangeToTimeline(c, { start: 5.5, end: 9 })).toEqual({ start: 13.5, end: 14 });
    expect(rangeToTimeline(c, { start: 7, end: 9 })).toBeNull();
    expect(rangeToTimeline(c, { start: 0, end: 1 })).toBeNull();
  });

  it('velocidade 2x comprime os tempos', () => {
    const c = clip({ speed: 2, duration: 3 }); // origem 2..8
    expect(rangeToTimeline(c, { start: 4, end: 6 })).toEqual({ start: 11, end: 12 });
  });

  it('reverso inverte a ordem', () => {
    const c = clip({ reverse: true }); // origem 2..6 tocada de trás para frente
    expect(rangeToTimeline(c, { start: 5, end: 6 })).toEqual({ start: 10, end: 11 });
    expect(rangeToTimeline(c, { start: 2, end: 3 })).toEqual({ start: 13, end: 14 });
  });

  it('quadro congelado não tem mapeamento', () => {
    expect(rangeToTimeline(clip({ freeze: true }), { start: 2, end: 3 })).toBeNull();
  });
});
