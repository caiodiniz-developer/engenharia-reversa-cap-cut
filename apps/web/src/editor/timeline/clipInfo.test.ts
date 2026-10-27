import { describe, expect, it } from 'vitest';
import { MediaClipSchema, type MediaClip } from '@editor/core';
import { clipTooltip } from './clipInfo';

const mediaClip = (mediaId: string, start: number, duration: number, extra: Partial<MediaClip> = {}): MediaClip => MediaClipSchema.parse({ id: 'c-' + start, type: 'media', mediaId, start, duration, ...extra });

describe('clipTooltip', () => {
  it('clipe simples mostra nome, início e duração', () => {
    expect(clipTooltip(mediaClip('m1', 65, 5), 'cena.mp4')).toBe('cena.mp4 · início 1:05 · duração 0:05');
  });

  it('lista só o que foi alterado: velocidade, efeitos, som, fades e keyframes', () => {
    const c = mediaClip('m1', 0, 2.5, {
      speed: 2,
      audio: { volume: 0.5, muted: false, fadeIn: 1, fadeOut: 0.5, normalize: false, denoise: false, eq: { bass: 0, mid: 0, treble: 0 }, pan: 0 },
      effects: [{ id: 'a', type: 'blur', enabled: true, params: {} }, { id: 'b', type: 'sepia', enabled: false, params: {} }],
      keyframes: { x: [{ time: 0, value: 0, easing: 'linear' }, { time: 1, value: 1, easing: 'linear' }] },
    } as Partial<MediaClip>);
    const text = clipTooltip(c, 'a.mp4');
    expect(text).toContain('velocidade 2×');
    expect(text).toContain('1 efeito'); // o efeito desligado não conta
    expect(text).toContain('volume 50%');
    expect(text).toContain('fade 0:01 / 0:00.5');
    expect(text).toContain('2 keyframes');
  });

  it('mudo substitui o volume', () => {
    const c = mediaClip('m1', 0, 1, { audio: { volume: 0.2, muted: true } as never });
    expect(clipTooltip(c, 'x')).toContain('sem som');
    expect(clipTooltip(c, 'x')).not.toContain('volume');
  });
});
