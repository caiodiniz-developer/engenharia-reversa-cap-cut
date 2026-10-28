import { describe, expect, it } from 'vitest';
import { getPlatform, isInsideSafe, matchesAspect, PLATFORMS, safeRect } from './platforms';

describe('plataformas de destino', () => {
  it('ids únicos, dimensões pares e zonas seguras que deixam área útil', () => {
    expect(new Set(PLATFORMS.map((p) => p.id)).size).toBe(PLATFORMS.length);
    for (const p of PLATFORMS) {
      expect(p.width % 2, p.id).toBe(0);
      expect(p.height % 2, p.id).toBe(0);
      const r = safeRect(p);
      expect(r.w, p.id).toBeGreaterThan(0.5);
      expect(r.h, p.id).toBeGreaterThan(0.4);
    }
  });

  it('plataformas verticais cobrem mais a base (legendas) do que o topo', () => {
    for (const id of ['shorts', 'reels', 'tiktok', 'stories']) {
      const p = getPlatform(id)!;
      expect(p.safe.bottom, id).toBeGreaterThan(p.safe.top);
    }
  });

  it('matchesAspect compara proporções, não tamanhos', () => {
    const shorts = getPlatform('shorts')!;
    expect(matchesAspect(shorts, 1080, 1920)).toBe(true);
    expect(matchesAspect(shorts, 720, 1280)).toBe(true);
    expect(matchesAspect(shorts, 1920, 1080)).toBe(false);
    expect(matchesAspect(shorts, 0, 0)).toBe(false);
    expect(matchesAspect(getPlatform('feed')!, 1000, 1000)).toBe(true);
  });

  it('isInsideSafe: centro está dentro; extremos de baixo e direita não (em vertical)', () => {
    const tiktok = getPlatform('tiktok')!;
    expect(isInsideSafe(tiktok, 0, 0)).toBe(true);
    expect(isInsideSafe(tiktok, 0, 0.4)).toBe(false); // 90% da altura: sob a interface
    expect(isInsideSafe(tiktok, 0.42, 0)).toBe(false); // encostado à direita
    expect(isInsideSafe(tiktok, -0.4, -0.3)).toBe(true);
  });

  it('safeRect devolve frações coerentes com os recuos', () => {
    const p = getPlatform('youtube')!;
    const r = safeRect(p);
    expect(r.x).toBe(p.safe.left);
    expect(r.x + r.w).toBeCloseTo(1 - p.safe.right, 10);
    expect(r.y + r.h).toBeCloseTo(1 - p.safe.bottom, 10);
  });

  it('getPlatform devolve undefined para id desconhecido', () => {
    expect(getPlatform('nao-existe')).toBeUndefined();
  });
});
