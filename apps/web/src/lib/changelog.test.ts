import { describe, expect, it } from 'vitest';
import { buildExtraCommands } from '../editor/extraCommands';
import { NEWS } from './changelog';

describe('changelog do editor', () => {
  it('toda novidade que cita um comando aponta para um comando que existe', () => {
    const ids = new Set(buildExtraCommands().map((c) => c.id));
    for (const e of NEWS) for (const i of e.items) if (i.command) expect(ids.has(i.command), i.command).toBe(true);
  });

  it('datas válidas, do mais recente para o mais antigo, e cada entrada tem itens', () => {
    for (const e of NEWS) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(e.date))).toBe(false);
      expect(e.items.length).toBeGreaterThan(0);
    }
    const dates = NEWS.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('textos únicos e sem espaços sobrando', () => {
    const texts = NEWS.flatMap((e) => e.items.map((i) => i.text));
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.every((t) => t === t.trim() && t.length > 15)).toBe(true);
  });
});
