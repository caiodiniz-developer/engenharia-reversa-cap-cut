export interface MatchPart {
  text: string;
  match: boolean;
}

const fold = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Divide o rótulo em trechos que casam (match) ou não com algum termo da busca. A comparação ignora acentos e
 * maiúsculas, mas o texto devolvido é o original (com acentos). Termos repetidos e sobrepostos viram um único trecho.
 */
export function highlightMatch(label: string, query: string): MatchPart[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length || !label) return [{ text: label, match: false }];
  const chars = [...label];
  let folded = '';
  const origin: number[] = [];
  chars.forEach((ch, i) => {
    for (const f of fold(ch)) {
      folded += f;
      origin.push(i);
    }
  });
  const marked = new Array<boolean>(chars.length).fill(false);
  for (const t of terms) {
    for (let from = 0; ; ) {
      const at = folded.indexOf(t, from);
      if (at < 0) break;
      for (let k = at; k < at + t.length; k++) marked[origin[k]!] = true;
      from = at + t.length;
    }
  }
  const parts: MatchPart[] = [];
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += ch;
    else parts.push({ text: ch, match: marked[i]! });
  });
  return parts;
}
