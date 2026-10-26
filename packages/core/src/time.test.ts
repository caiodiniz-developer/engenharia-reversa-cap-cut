import { describe, expect, it } from 'vitest';
import { formatTimecode, parseTimecode } from './time';

describe('parseTimecode', () => {
  it('segundos simples, com ponto ou vírgula', () => {
    expect(parseTimecode('90', 30)).toBe(90);
    expect(parseTimecode('1.5', 30)).toBe(1.5);
    expect(parseTimecode(' 2,25 ', 30)).toBe(2.25);
  });

  it('min:s e h:min:s', () => {
    expect(parseTimecode('1:30', 30)).toBe(90);
    expect(parseTimecode('0:05.5', 30)).toBe(5.5);
    expect(parseTimecode('1:02:03', 30)).toBe(3723);
  });

  it('h:min:s:quadros usa o fps do projeto', () => {
    expect(parseTimecode('00:00:01:15', 30)).toBe(1.5);
    expect(parseTimecode('00:01:00:12', 24)).toBe(60.5);
    expect(parseTimecode('00:00:01:30', 30)).toBeNull(); // quadro 30 não existe a 30 fps
  });

  it('formas com unidades: 2m30s, 1h5m, 45s, 12f', () => {
    expect(parseTimecode('2m30s', 30)).toBe(150);
    expect(parseTimecode('1h5m', 30)).toBe(3900);
    expect(parseTimecode('45s', 30)).toBe(45);
    expect(parseTimecode('12f', 24)).toBe(0.5);
  });

  it('recusa lixo, negativos e minutos/segundos fora de 0–59', () => {
    for (const bad of ['', 'abc', '-3', '1:75', '1:2:99', '1::2', '1m 2x']) expect(parseTimecode(bad, 30), bad).toBeNull();
  });

  it('é o inverso de formatTimecode', () => {
    for (const t of [0, 1.5, 61.2, 3725.4]) {
      const fps = 30;
      const back = parseTimecode(formatTimecode(t, fps), fps)!;
      expect(Math.abs(back - Math.floor(t * fps) / fps)).toBeLessThan(1e-3);
    }
  });
});
