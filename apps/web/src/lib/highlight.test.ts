import { describe, expect, it } from 'vitest';
import { highlightMatch } from './highlight';

const join = (label: string, q: string) => highlightMatch(label, q).map((p) => (p.match ? '[' + p.text + ']' : p.text)).join('');

describe('highlightMatch', () => {
  it('ignora acentos e maiúsculas, mas devolve o texto original', () => {
    expect(join('Dividir clipe na cabeça de reprodução', 'cabeca')).toBe('Dividir clipe na [cabeça] de reprodução');
    expect(join('Dividir clipe', 'DIVIDIR')).toBe('[Dividir] clipe');
    expect(join('Ação rápida', 'acao')).toBe('[Ação] rápida');
  });

  it('vários termos, em qualquer ordem, e todas as ocorrências', () => {
    expect(join('Abrir painel: Animações', 'animacoes abrir')).toBe('[Abrir] painel: [Animações]');
    expect(join('banana', 'an')).toBe('b[anan]a');
  });

  it('termos que se sobrepõem ou se repetem viram um só trecho', () => {
    expect(join('Selecionar clipes', 'sele ecio')).toBe('[Selecio]nar clipes');
    expect(join('clipe clipe', 'clip clip')).toBe('[clip]e [clip]e');
  });

  it('sem busca, busca só de espaços, rótulo vazio e sem ocorrência', () => {
    expect(highlightMatch('Exportar', '')).toEqual([{ text: 'Exportar', match: false }]);
    expect(highlightMatch('Exportar', '   ')).toEqual([{ text: 'Exportar', match: false }]);
    expect(highlightMatch('', 'x')).toEqual([{ text: '', match: false }]);
    expect(join('Exportar', 'zzz')).toBe('Exportar');
  });

  it('a concatenação dos trechos é sempre o rótulo inteiro (inclusive com emoji)', () => {
    for (const label of ['Ação 🎬 rápida', 'Vídeo → áudio', 'a']) {
      expect(highlightMatch(label, 'a vi').map((p) => p.text).join('')).toBe(label);
    }
  });
});
