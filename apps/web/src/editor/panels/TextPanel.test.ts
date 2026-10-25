import { describe, expect, it } from 'vitest';
import { TextStyleSchema } from '@editor/core';
import { PRESETS } from './TextPanel';

describe('predefinições de texto', () => {
  it('todas têm id único, rótulo e um estilo válido para o schema do projeto', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(p.label.length, p.id).toBeGreaterThan(0);
      expect(() => TextStyleSchema.parse(p.style), p.id).not.toThrow();
    }
  });

  it('o terço inferior é alinhado à esquerda e tem fundo; o marca-texto tem fundo opaco', () => {
    const lower = PRESETS.find((p) => p.id === 'lower')!;
    expect(lower.style.align).toBe('left');
    expect(lower.style.background).toBeTruthy();
    expect(PRESETS.find((p) => p.id === 'highlight')!.style.background).toMatch(/^#[0-9a-f]{8}$/i);
  });
});
