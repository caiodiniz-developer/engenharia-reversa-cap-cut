import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPlacement';

const vp = { width: 1000, height: 700 };
const tip = { width: 120, height: 30 };
const box = (left: number, top: number, width = 30, height = 30) => ({ left, top, width, height });

describe('placeTooltip', () => {
  it('fica centrado embaixo do alvo, com o espaço pedido', () => {
    const p = placeTooltip(box(400, 100), tip, vp);
    expect(p.side).toBe('bottom');
    expect(p.x).toBe(400 + 15 - 60);
    expect(p.y).toBe(100 + 30 + 8);
    expect(p.arrowX).toBe(60);
  });

  it('é preso às bordas da tela e a seta continua apontando para o centro do alvo', () => {
    const left = placeTooltip(box(0, 100), tip, vp);
    expect(left.x).toBe(8);
    expect(left.arrowX).toBe(15 - 8);
    const right = placeTooltip(box(980, 100), tip, vp);
    expect(right.x).toBe(1000 - 120 - 8);
    expect(right.arrowX).toBe(995 - right.x);
  });

  it('inverte para cima quando embaixo não cabe, e volta para baixo se preferido e couber', () => {
    expect(placeTooltip(box(400, 680), tip, vp).side).toBe('top');
    expect(placeTooltip(box(400, 680), tip, vp).y).toBe(680 - 8 - 30);
    expect(placeTooltip(box(400, 300), tip, vp, { prefer: 'top' }).side).toBe('top');
    expect(placeTooltip(box(400, 5), tip, vp, { prefer: 'top' }).side).toBe('bottom');
  });

  it('sem espaço em nenhum lado, usa o lado maior e não sai da tela', () => {
    const tiny = { width: 300, height: 60 };
    const p = placeTooltip(box(100, 20, 30, 20), { width: 100, height: 50 }, tiny);
    expect(p.y).toBeGreaterThanOrEqual(8);
    expect(p.y + 50).toBeLessThanOrEqual(60 - 8 + 50);
    const q = placeTooltip(box(100, 30, 30, 20), { width: 100, height: 50 }, tiny);
    expect(['top', 'bottom']).toContain(q.side);
  });
});
