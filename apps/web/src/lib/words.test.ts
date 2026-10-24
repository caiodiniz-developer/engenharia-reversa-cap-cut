import { describe, expect, it } from 'vitest';
import { editCaptionText, wordsFromText } from './words';

describe('palavras da legenda', () => {
  it('distribui o tempo proporcionalmente ao tamanho e cobre toda a duração', () => {
    const w = wordsFromText('oi mundo grande', 3);
    expect(w.map((x) => x.text)).toEqual(['oi', 'mundo', 'grande']);
    expect(w[0]!.start).toBe(0);
    expect(w.at(-1)!.end).toBe(3);
    for (let i = 1; i < w.length; i++) expect(w[i]!.start).toBe(w[i - 1]!.end);
  });

  it('corrigir a grafia mantém os tempos originais', () => {
    const original = [{ text: 'ola', start: 0, end: 0.4 }, { text: 'mundo', start: 0.6, end: 1.2 }];
    const edited = editCaptionText('olá mundo', original, 2);
    expect(edited).toEqual([{ text: 'olá', start: 0, end: 0.4 }, { text: 'mundo', start: 0.6, end: 1.2 }]);
  });

  it('mudar a quantidade de palavras redistribui', () => {
    const edited = editCaptionText('uma frase nova toda', [{ text: 'a', start: 0, end: 1 }], 4);
    expect(edited).toHaveLength(4);
    expect(edited.at(-1)!.end).toBe(4);
  });

  it('texto vazio gera lista vazia', () => {
    expect(wordsFromText('   ', 2)).toEqual([]);
  });
});
