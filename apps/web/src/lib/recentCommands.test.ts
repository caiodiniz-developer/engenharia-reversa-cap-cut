import { beforeEach, describe, expect, it } from 'vitest';
import { loadRecent, MAX_RECENT, pushRecent, saveRecent, withRecentFirst } from './recentCommands';

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('comandos recentes da paleta', () => {
  it('pushRecent põe o último usado no topo, sem repetir', () => {
    expect(pushRecent(['b', 'a'], 'c')).toEqual(['c', 'b', 'a']);
    expect(pushRecent(['b', 'a'], 'a')).toEqual(['a', 'b']);
  });

  it('pushRecent limita o tamanho da lista', () => {
    let list: string[] = [];
    for (let i = 0; i < 20; i++) list = pushRecent(list, 'id' + i);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe('id19');
  });

  it('withRecentFirst move os recentes para o início na ordem de uso e mantém o resto', () => {
    expect(withRecentFirst(items, ['c', 'a']).map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('withRecentFirst ignora ids que não existem mais e não duplica', () => {
    expect(withRecentFirst(items, ['zzz', 'b', 'b']).map((i) => i.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(withRecentFirst(items, []).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  describe('armazenamento', () => {
    beforeEach(() => localStorage.clear());

    it('salva e carrega; lixo no armazenamento vira lista vazia', () => {
      saveRecent(['x', 'y']);
      expect(loadRecent()).toEqual(['x', 'y']);
      localStorage.setItem('editor.palette.recent', '{"quebrado"');
      expect(loadRecent()).toEqual([]);
      localStorage.setItem('editor.palette.recent', '[1,"ok",null]');
      expect(loadRecent()).toEqual(['ok']);
    });
  });
});
