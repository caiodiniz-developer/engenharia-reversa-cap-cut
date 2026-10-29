import { buildCommands, searchCommands, type Command } from '../../../editor/commands';

const noop = () => {};

let cache: Command[] | null = null;

/** Todos os comandos reais do editor (os mesmos da paleta Ctrl+K), sem ligação com o projeto aberto. */
export function demoCommands(): Command[] {
  return (cache ??= buildCommands({ openPanel: noop, onExport: noop, onHelp: noop, goHome: noop }));
}

/** Ids mostrados quando a caixa de busca está vazia: os comandos de edição mais conhecidos. */
export const POPULAR = ['split', 'export', 'undo', 'duplicate', 'marker', 'theme'];

/** Resultado da busca da paleta (mesma função do editor). Sem texto, mostra os mais populares. */
export function searchDemo(query: string, limit = 6): Command[] {
  const all = demoCommands();
  if (!query.trim()) return POPULAR.map((id) => all.find((c) => c.id === id)).filter((c): c is Command => !!c).slice(0, limit);
  return searchCommands(all, query).slice(0, limit);
}

/**
 * Texto visível de uma animação de digitação no instante `tick`: digita cada palavra letra a letra,
 * espera `hold` ticks e apaga antes de passar para a próxima (cíclico).
 */
export function typewriterFrame(words: string[], tick: number, hold = 8): string {
  if (!words.length) return '';
  const cycle = words.map((w) => w.length * 2 + hold);
  const total = cycle.reduce((a, b) => a + b, 0);
  let t = ((tick % total) + total) % total;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (t < cycle[i]!) {
      if (t < w.length) return w.slice(0, t + 1);
      if (t < w.length + hold) return w;
      return w.slice(0, Math.max(0, w.length - (t - w.length - hold) - 1));
    }
    t -= cycle[i]!;
  }
  return '';
}
