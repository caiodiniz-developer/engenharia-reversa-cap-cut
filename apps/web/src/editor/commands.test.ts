import { describe, expect, it } from 'vitest';
import { buildCommands, searchCommands } from './commands';

const list = buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} });

describe('paleta de comandos', () => {
  it('todos os comandos têm id único e rótulo', () => {
    const ids = list.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(list.every((c) => c.label.length > 3 && c.group)).toBe(true);
    expect(list.length).toBeGreaterThan(30);
  });

  it('a busca ignora acentos e maiúsculas', () => {
    expect(searchCommands(list, 'reproduzir')[0]!.id).toBe('play');
    expect(searchCommands(list, 'REPRODUZIR')[0]!.id).toBe('play');
    expect(searchCommands(list, 'animacoes').map((c) => c.id)).toContain('open-animations');
    expect(searchCommands(list, 'audio').some((c) => c.id === 'open-audio')).toBe(true);
  });

  it('exige todos os termos, em qualquer ordem, e usa as palavras-chave', () => {
    expect(searchCommands(list, 'faixa video').map((c) => c.id)).toContain('track-video');
    expect(searchCommands(list, 'video faixa').map((c) => c.id)).toContain('track-video');
    expect(searchCommands(list, 'ripple').map((c) => c.id)).toContain('ripple');
    expect(searchCommands(list, 'mp4').map((c) => c.id)).toContain('export');
    expect(searchCommands(list, 'xyzinexistente')).toEqual([]);
  });

  it('consulta vazia devolve tudo; rótulo que começa com o termo vem antes', () => {
    expect(searchCommands(list, '  ')).toHaveLength(list.length);
    const r = searchCommands(list, 'salvar');
    expect(r[0]!.id).toBe('save');
  });
});
