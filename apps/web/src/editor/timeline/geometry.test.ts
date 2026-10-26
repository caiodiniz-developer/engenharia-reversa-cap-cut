import { describe, expect, it } from 'vitest';
import { TRACK_DENSITIES, trackHeight } from './geometry';

describe('altura das faixas', () => {
  it('normal mantém as alturas originais', () => {
    expect(trackHeight('video')).toBe(68);
    expect(trackHeight('audio')).toBe(52);
    expect(trackHeight('text')).toBe(40);
    expect(trackHeight('caption', 'normal')).toBe(40);
  });

  it('compacta < normal < alta para todos os tipos', () => {
    for (const kind of ['video', 'audio', 'text', 'caption'] as const) {
      const [c, n, t] = TRACK_DENSITIES.map((d) => trackHeight(kind, d));
      expect(c!, kind).toBeLessThan(n!);
      expect(n!, kind).toBeLessThan(t!);
    }
  });

  it('nunca fica abaixo de 32 px (cabem os botões do cabeçalho)', () => {
    for (const kind of ['video', 'audio', 'text', 'caption'] as const) expect(trackHeight(kind, 'compact')).toBeGreaterThanOrEqual(32);
  });
});
