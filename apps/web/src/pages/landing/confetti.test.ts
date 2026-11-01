import { describe, expect, it } from 'vitest';
import { makeParticles, stepParticles } from './confetti';

const origin = { x: 100, y: 200 };

describe('confete', () => {
  it('a mesma semente repete as partículas e outra semente muda', () => {
    expect(makeParticles(20, 7, origin)).toEqual(makeParticles(20, 7, origin));
    expect(makeParticles(20, 8, origin)).not.toEqual(makeParticles(20, 7, origin));
    expect(makeParticles(0, 1, origin)).toEqual([]);
    expect(makeParticles(-3, 1, origin)).toEqual([]);
  });

  it('todas saem da origem subindo (vy negativo) e com vida e tamanho positivos', () => {
    const ps = makeParticles(60, 3, origin);
    expect(ps).toHaveLength(60);
    for (const p of ps) {
      expect([p.x, p.y]).toEqual([100, 200]);
      expect(p.vy).toBeLessThan(0);
      expect(p.life).toBeGreaterThan(1.5);
      expect(p.size).toBeGreaterThan(5);
    }
  });

  it('a gravidade reduz a subida até virar queda', () => {
    let ps = makeParticles(1, 5, origin);
    const first = ps[0]!.vy;
    ps = stepParticles(ps, 0.1);
    expect(ps[0]!.vy).toBeGreaterThan(first);
    for (let i = 0; i < 12; i++) ps = stepParticles(ps, 0.1);
    expect(ps[0]!.vy).toBeGreaterThan(0); // já está caindo
    expect(ps[0]!.y).toBeGreaterThan(0);
  });

  it('as partículas acabam quando a vida passa e a lista original não muda', () => {
    const ps = makeParticles(30, 9, origin);
    const copy = JSON.stringify(ps);
    let cur = ps;
    for (let i = 0; i < 40; i++) cur = stepParticles(cur, 0.1); // 4 s > vida máxima (2,6 s)
    expect(cur).toEqual([]);
    expect(JSON.stringify(ps)).toBe(copy);
    expect(stepParticles(ps, 0.5).length).toBe(30);
  });
});
