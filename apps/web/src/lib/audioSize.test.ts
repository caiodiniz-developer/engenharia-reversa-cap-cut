import { describe, expect, it } from 'vitest';
import { estimateAudioBytes } from './audioSize';

describe('estimateAudioBytes', () => {
  it('WAV estéreo 16 bits: taxa de amostragem × 4 bytes por segundo + cabeçalho', () => {
    expect(estimateAudioBytes('wav', 10, 48000)).toBe(44 + 10 * 48000 * 4);
    expect(estimateAudioBytes('wav', 1, 44100)).toBe(44 + 44100 * 4);
  });

  it('MP3 e M4A a 192 kbit/s: 24.000 bytes por segundo', () => {
    expect(estimateAudioBytes('mp3', 10)).toBe(240_000);
    expect(estimateAudioBytes('m4a', 60)).toBe(1_440_000);
  });

  it('duração zero ou negativa não gera tamanho negativo', () => {
    expect(estimateAudioBytes('mp3', 0)).toBe(0);
    expect(estimateAudioBytes('mp3', -5)).toBe(0);
    expect(estimateAudioBytes('wav', -5)).toBe(44);
  });
});
