import { describe, expect, it } from 'vitest';
import { buildCommands, searchCommands } from './commands';

const list = buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} });
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

describe('busca de comandos com @grupo', () => {
  it('só o grupo lista tudo daquele grupo e nada de fora', () => {
    const r = searchCommands(list, '@audio');
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((c) => norm(c.group).includes('audio'))).toBe(true);
  });

  it('grupo + termo restringe dentro do grupo', () => {
    const all = searchCommands(list, '@audio');
    const fades = searchCommands(list, '@audio fade');
    expect(fades.length).toBeGreaterThan(0);
    expect(fades.length).toBeLessThan(all.length);
    expect(fades.every((c) => norm(c.group).includes('audio') && norm(c.label + ' ' + (c.keywords ?? '')).includes('fade'))).toBe(true);
  });

  it('grupo que não existe devolve vazio e a busca comum continua igual', () => {
    expect(searchCommands(list, '@inexistente')).toEqual([]);
    expect(searchCommands(list, 'reproduzir')[0]!.id).toBe('play');
    expect(searchCommands(list, '  ')).toHaveLength(list.length);
  });

  it('o termo sozinho encontra comandos de vários grupos, que o @ separa', () => {
    const plain = searchCommands(list, 'fade');
    const groups = new Set(plain.map((c) => c.group));
    expect(groups.size).toBeGreaterThan(1);
  });
});
