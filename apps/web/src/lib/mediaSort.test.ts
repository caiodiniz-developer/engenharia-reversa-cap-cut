import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../api/types';
import { sortMedia } from './mediaSort';

const item = (id: string, name: string, duration: number, size: number): MediaItem => ({
  id,
  name,
  kind: 'video',
  duration,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  size,
  mime: 'video/mp4',
  status: 'ready',
  error: null,
  urls: { original: '', proxy: null, thumb: null, waveform: null, film: null },
});

const list = [item('a', 'clipe 10.mp4', 5, 300), item('b', 'clipe 2.mp4', 20, 100), item('c', 'Abertura.mp4', 20, 900)];

describe('ordenação da biblioteca de mídia', () => {
  it('por nome usa ordem natural (2 antes de 10) e ignora maiúsculas', () => {
    expect(sortMedia(list, 'name').map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('por duração: mais longas primeiro, empate pelo nome', () => {
    expect(sortMedia(list, 'duration').map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('por tamanho: maiores primeiro', () => {
    expect(sortMedia(list, 'size').map((m) => m.id)).toEqual(['c', 'a', 'b']);
  });

  it('não usadas primeiro, depois as usadas, ambas por nome', () => {
    expect(sortMedia(list, 'unused', new Set(['c'])).map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });

  it('não altera o array original', () => {
    const copy = [...list];
    sortMedia(list, 'size');
    expect(list).toEqual(copy);
  });
});
