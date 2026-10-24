import { round6, type CaptionWord } from '@editor/core';

/** Distribui as palavras de um texto pela duração, proporcionalmente ao tamanho (usado ao editar o texto da legenda). */
export function wordsFromText(text: string, duration: number): CaptionWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const total = tokens.reduce((n, t) => n + t.length, 0) || 1;
  let acc = 0;
  return tokens.map((t) => {
    const start = round6((acc / total) * duration);
    acc += t.length;
    return { text: t, start, end: round6((acc / total) * duration) };
  });
}

/**
 * Atualiza o texto de uma legenda preservando os tempos das palavras quando a quantidade não muda
 * (correção de grafia); caso contrário redistribui proporcionalmente.
 */
export function editCaptionText(text: string, words: CaptionWord[], duration: number): CaptionWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === words.length && words.length > 0) return words.map((w, i) => ({ ...w, text: tokens[i]! }));
  return wordsFromText(text, duration);
}
