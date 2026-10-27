import type { CaptionClip, Clip, Project, TextClip } from '../schema';
import { updateClip } from './clips';
import { requireClip } from './helpers';

export type TextCase = 'upper' | 'lower' | 'title' | 'sentence';

const lower = (s: string) => s.toLocaleLowerCase('pt-BR');
const upper = (s: string) => s.toLocaleUpperCase('pt-BR');

/** Converte o texto conforme o modo: MAIÚSCULAS, minúsculas, Cada Palavra Maiúscula ou só a primeira letra de cada frase. */
export function applyCase(text: string, mode: TextCase): string {
  switch (mode) {
    case 'upper':
      return upper(text);
    case 'lower':
      return lower(text);
    case 'title':
      return lower(text).replace(/(^|[\s\-–—("'“‘])(\p{L})/gu, (_, sep: string, ch: string) => sep + upper(ch));
    case 'sentence':
      return lower(text).replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, (_, sep: string, ch: string) => sep + upper(ch));
  }
}

type TextLike = TextClip | CaptionClip;
const isTextLike = (c: Clip): c is TextLike => c.type === 'text' || c.type === 'caption';

/** Aplica o modo aos clipes de texto/legenda escolhidos (palavras temporizadas das legendas acompanham). Ignora os demais. */
export function changeTextCase(p: Project, ids: string[], mode: TextCase): Project {
  let next = p;
  for (const id of new Set(ids)) {
    if (!isTextLike(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => {
      const t = c as TextLike;
      const out = { ...t, text: applyCase(t.text, mode) } as TextLike;
      if (out.type === 'caption' && out.words) out.words = out.words.map((w) => ({ ...w, text: applyCase(w.text, mode) }));
      return out;
    });
  }
  return next;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Localiza e substitui texto em todos os clipes de texto/legenda (ou só nos `ids`).
 * Devolve o projeto e quantas ocorrências foram trocadas. A busca é literal (não é expressão regular).
 */
export function replaceInText(
  p: Project,
  find: string,
  replacement: string,
  opts: { matchCase?: boolean; ids?: string[] } = {},
): { project: Project; count: number } {
  if (!find) return { project: p, count: 0 };
  const re = new RegExp(escapeRegExp(find), opts.matchCase ? 'g' : 'gi');
  const only = opts.ids ? new Set(opts.ids) : null;
  let count = 0;
  let next = p;
  for (const track of p.tracks) {
    if (track.locked) continue;
    for (const clip of track.clips) {
      if (!isTextLike(clip) || (only && !only.has(clip.id))) continue;
      const hits = clip.text.match(re)?.length ?? 0;
      if (!hits) continue;
      count += hits;
      next = updateClip(next, clip.id, (c) => {
        const t = c as TextLike;
        const out = { ...t, text: t.text.replace(re, () => replacement) } as TextLike;
        // palavras temporizadas só acompanham quando a troca preserva a contagem de palavras; senão o tempo por palavra é descartado
        if (out.type === 'caption' && out.words?.length) {
          const joined = out.words.map((w) => w.text).join(' ');
          const swapped = joined.replace(re, () => replacement);
          const parts = swapped.split(/\s+/).filter(Boolean);
          if (parts.length === out.words.length) out.words = out.words.map((w, i) => ({ ...w, text: parts[i]! }));
          else out.words = [];
        }
        return out;
      });
    }
  }
  return { project: next, count };
}
