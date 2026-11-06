const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface CommandQuery {
  /** Grupo pedido com @ (sem acento e em minúsculas); vazio se não houver. */
  group: string;
  /** O resto da busca. */
  text: string;
}

/** Separa "@áudio fade" em { group: 'audio', text: 'fade' }. Só vale se a busca começar com @ seguido de letras. */
export function parseCommandQuery(query: string): CommandQuery {
  const m = /^\s*@([^\s@]+)\s*(.*)$/s.exec(query);
  if (!m) return { group: '', text: query };
  return { group: fold(m[1]!), text: m[2]! };
}
