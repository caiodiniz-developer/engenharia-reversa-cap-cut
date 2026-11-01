/** Quebra o texto em palavras (espaços repetidos não geram palavras vazias). */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Atraso (s) da palavra ${index}: cresce de ${step} em ${step} e para em ${cap}, para títulos longos não demorarem demais. */
export function staggerDelay(index: number, step = 0.06, cap = 0.6): number {
  return Math.round(Math.min(Math.max(0, index) * step, cap) * 1e6) / 1e6;
}
