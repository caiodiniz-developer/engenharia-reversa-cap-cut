import { describe, expect, it } from 'vitest';
import { ROTATING_WORDS } from './RotatingWord';

describe('palavras que alternam no topo', () => {
  it('há palavras suficientes, sem repetir e sem texto vazio', () => {
    expect(ROTATING_WORDS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ROTATING_WORDS).size).toBe(ROTATING_WORDS.length);
    for (const w of ROTATING_WORDS) expect(w.trim().length).toBeGreaterThan(3);
  });
});
