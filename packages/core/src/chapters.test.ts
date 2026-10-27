import { describe, expect, it } from 'vitest';
import { chapterTime, markersToChapters } from './chapters';

describe('chapterTime', () => {
  it('m:ss abaixo de uma hora e h:mm:ss a partir dela; trunca frações', () => {
    expect(chapterTime(0)).toBe('0:00');
    expect(chapterTime(9.9)).toBe('0:09');
    expect(chapterTime(75)).toBe('1:15');
    expect(chapterTime(3599)).toBe('59:59');
    expect(chapterTime(3600)).toBe('1:00:00');
    expect(chapterTime(3725)).toBe('1:02:05');
    expect(chapterTime(-4)).toBe('0:00');
  });
});

describe('markersToChapters', () => {
  it('ordena por tempo e ancora o primeiro capítulo em 0:00', () => {
    const text = markersToChapters([
      { time: 95, label: 'Final' },
      { time: 12, label: 'Introdução' },
      { time: 40, label: 'Meio' },
    ]);
    expect(text).toBe('0:00 Introdução\n0:40 Meio\n1:35 Final');
  });

  it('omite marcadores a menos de 10 s do capítulo anterior (regra do YouTube)', () => {
    const text = markersToChapters([
      { time: 0, label: 'A' },
      { time: 4, label: 'colado' },
      { time: 20, label: 'B' },
    ]);
    expect(text).toBe('0:00 A\n0:20 B');
  });

  it('o intervalo mínimo pode ser ajustado', () => {
    const text = markersToChapters([{ time: 0, label: 'A' }, { time: 4, label: 'B' }], { minGap: 2 });
    expect(text).toBe('0:00 A\n0:04 B');
  });

  it('marcador sem nome vira "Capítulo N" pela posição na lista', () => {
    expect(markersToChapters([{ time: 0, label: '' }, { time: 30, label: '   ' }])).toBe('0:00 Capítulo 1\n0:30 Capítulo 2');
  });

  it('sem marcadores devolve texto vazio', () => {
    expect(markersToChapters([])).toBe('');
  });
});
