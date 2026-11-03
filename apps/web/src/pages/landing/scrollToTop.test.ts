import { describe, expect, it, vi } from 'vitest';
import { scrollToTop } from './scroll';

describe('scrollToTop', () => {
  it('rola até o topo com animação suave', () => {
    const scrollTo = vi.fn();
    scrollToTop({ scrollTo } as never, false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('com menos movimento o salto é imediato', () => {
    const scrollTo = vi.fn();
    scrollToTop({ scrollTo } as never, true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('sem elemento não faz nada nem lança erro', () => {
    expect(() => scrollToTop(null, false)).not.toThrow();
  });
});
