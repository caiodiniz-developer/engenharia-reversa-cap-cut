/**
 * Tarefas de edição ancoradas no tempo: um marcador cujo nome começa com "☐ " é uma tarefa aberta e com "☑ ", uma
 * tarefa concluída. Nenhum campo novo no projeto — a convenção vive no nome do marcador, então funciona em
 * qualquer versão do arquivo e aparece também na régua.
 */
export const TODO_OPEN = '☐ ';
export const TODO_DONE = '☑ ';

export interface TodoInfo {
  isTodo: boolean;
  done: boolean;
  /** Texto da tarefa, sem o prefixo. */
  text: string;
}

export function parseTodo(label: string): TodoInfo {
  if (label.startsWith(TODO_OPEN)) return { isTodo: true, done: false, text: label.slice(TODO_OPEN.length) };
  if (label.startsWith(TODO_DONE)) return { isTodo: true, done: true, text: label.slice(TODO_DONE.length) };
  return { isTodo: false, done: false, text: label };
}

/** Monta o nome de um marcador de tarefa. */
export function makeTodo(text: string, done = false): string {
  return (done ? TODO_DONE : TODO_OPEN) + text.trim();
}

/** Alterna aberta/concluída. Um marcador comum vira tarefa aberta (mantendo o nome). */
export function toggleTodo(label: string): string {
  const t = parseTodo(label);
  return makeTodo(t.text, t.isTodo ? !t.done : false);
}

/** Resumo de um conjunto de marcadores: quantas tarefas existem e quantas já foram concluídas. */
export function todoSummary(markers: Array<{ label: string }>): { total: number; done: number; open: number } {
  let total = 0;
  let done = 0;
  for (const m of markers) {
    const t = parseTodo(m.label);
    if (!t.isTodo) continue;
    total++;
    if (t.done) done++;
  }
  return { total, done, open: total - done };
}
