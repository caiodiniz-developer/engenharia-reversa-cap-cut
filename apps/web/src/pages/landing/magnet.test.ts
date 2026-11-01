import { describe, expect, it } from 'vitest';
import { magnetOffset } from './magnet';

describe('magnetOffset', () => {
  it('fora do raio (ou raio inválido) não mexe', () => {
    expect(magnetOffset(200, 0, 120)).toEqual({ x: 0, y: 0 });
    expect(magnetOffset(120, 0, 120)).toEqual({ x: 0, y: 0 });
    expect(magnetOffset(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });

  it('dentro do raio anda para o lado do cursor, com o mesmo sinal', () => {
    const o = magnetOffset(-60, 30, 120);
    expect(o.x).toBeLessThan(0);
    expect(o.y).toBeGreaterThan(0);
    expect(Math.abs(o.x / o.y)).toBeCloseTo(2, 6); // mesma direção do cursor
  });

  it('no centro não mexe e perto da borda quase não mexe (sem pulo)', () => {
    expect(magnetOffset(0, 0, 120)).toEqual({ x: 0, y: 0 });
    expect(Math.abs(magnetOffset(119.9, 0, 120).x)).toBeLessThan(0.1);
  });

  it('nunca passa de strength × raio ÷ 4', () => {
    const limit = (0.35 * 120) / 4;
    let max = 0;
    for (let d = 0; d < 120; d += 0.5) max = Math.max(max, Math.abs(magnetOffset(d, 0, 120).x));
    expect(max).toBeLessThanOrEqual(limit + 1e-9);
    expect(max).toBeGreaterThan(limit * 0.98); // o pico existe, perto da metade do raio
  });
});
