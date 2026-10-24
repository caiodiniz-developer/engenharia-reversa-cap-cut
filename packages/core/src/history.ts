export interface HistoryEntry<T> {
  state: T;
  label: string;
  /** Operações com a mesma chave consecutivas (ex.: arrastar) são fundidas num único passo de undo. */
  coalesceKey?: string;
}

export interface History<T> {
  entries: HistoryEntry<T>[];
  /** Índice do estado atual em `entries`. */
  index: number;
  limit: number;
}

export function createHistory<T>(initial: T, limit = 300): History<T> {
  return { entries: [{ state: initial, label: 'Estado inicial' }], index: 0, limit };
}

export const present = <T>(h: History<T>): T => h.entries[h.index]!.state;

export const canUndo = <T>(h: History<T>): boolean => h.index > 0;
export const canRedo = <T>(h: History<T>): boolean => h.index < h.entries.length - 1;

export function commit<T>(h: History<T>, state: T, label: string, coalesceKey?: string): History<T> {
  if (Object.is(state, present(h))) return h;
  const current = h.entries[h.index]!;
  let entries = h.entries.slice(0, h.index + 1);
  if (coalesceKey && current.coalesceKey === coalesceKey && h.index > 0) {
    entries[entries.length - 1] = { state, label, coalesceKey };
  } else {
    entries.push({ state, label, coalesceKey });
  }
  if (entries.length > h.limit) entries = entries.slice(entries.length - h.limit);
  return { ...h, entries, index: entries.length - 1 };
}

export function undo<T>(h: History<T>): History<T> {
  return canUndo(h) ? { ...h, index: h.index - 1 } : h;
}

export function redo<T>(h: History<T>): History<T> {
  return canRedo(h) ? { ...h, index: h.index + 1 } : h;
}

export function jumpTo<T>(h: History<T>, index: number): History<T> {
  if (index < 0 || index >= h.entries.length) return h;
  return { ...h, index };
}

/** Quebra a fusão: a próxima operação com a mesma chave abre um novo passo. */
export function sealCoalescing<T>(h: History<T>): History<T> {
  const entries = [...h.entries];
  const cur = entries[h.index]!;
  entries[h.index] = { ...cur, coalesceKey: undefined };
  return { ...h, entries };
}
