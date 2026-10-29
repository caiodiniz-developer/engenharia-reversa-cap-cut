import { describe, expect, it } from 'vitest';
import { DEMO_TOTAL, pacingDemoState, shotLengths } from './pacingModel';

describe('demonstração do ritmo', () => {
  it('as durações somam o total e nenhuma é menor que 0,3 s, para qualquer média', () => {
    for (const avg of [0.5, 0.8, 1.5, 3, 6.4, 10, 29, 60]) {
      const l = shotLengths(avg);
      expect(Math.round(l.reduce((a, b) => a + b, 0) * 10) / 10, String(avg)).toBe(DEMO_TOTAL);
      for (const x of l) expect(x, String(avg)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('a média real fica perto da pedida (±35%) nas faixas usadas na demonstração', () => {
    for (const avg of [1, 2, 4, 8]) {
      const s = pacingDemoState(avg).stats;
      expect(s.average, String(avg)).toBeGreaterThan(avg * 0.65);
      expect(s.average, String(avg)).toBeLessThan(avg * 1.35);
    }
  });

  it('o rótulo passa de Frenético a Contemplativo conforme a duração cresce', () => {
    const order = ['Frenético', 'Dinâmico', 'Moderado', 'Contemplativo'];
    const labels = [0.9, 2, 4, 9].map((a) => pacingDemoState(a).label);
    expect(labels).toEqual(order);
  });

  it('mais cortes por minuto quando os planos são curtos e trechos parados só aparecem nos planos longos', () => {
    const fast = pacingDemoState(1);
    const slow = pacingDemoState(20);
    expect(fast.stats.cutsPerMinute).toBeGreaterThan(slow.stats.cutsPerMinute * 4);
    expect(fast.still).toEqual([]);
    expect(slow.still.length).toBeGreaterThan(0);
  });

  it('a curva cobre os 30 s em janelas de 5 s', () => {
    expect(pacingDemoState(3).curve).toHaveLength(6);
  });
});
