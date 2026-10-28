import { describe, expect, it } from 'vitest';
import { makeTodo, parseTodo, todoSummary, toggleTodo } from './todo';

describe('tarefas nos marcadores', () => {
  it('parseTodo reconhece aberta, concluída e marcador comum', () => {
    expect(parseTodo('☐ Cortar a respiração')).toEqual({ isTodo: true, done: false, text: 'Cortar a respiração' });
    expect(parseTodo('☑ Trocar música')).toEqual({ isTodo: true, done: true, text: 'Trocar música' });
    expect(parseTodo('Marcador 1')).toEqual({ isTodo: false, done: false, text: 'Marcador 1' });
    expect(parseTodo('☐sem espaço').isTodo).toBe(false);
  });

  it('makeTodo tira espaços das pontas', () => {
    expect(makeTodo('  Ajustar cor  ')).toBe('☐ Ajustar cor');
    expect(makeTodo('Feito', true)).toBe('☑ Feito');
  });

  it('toggleTodo alterna e transforma marcador comum em tarefa aberta', () => {
    expect(toggleTodo('☐ A')).toBe('☑ A');
    expect(toggleTodo('☑ A')).toBe('☐ A');
    expect(toggleTodo('Corte aqui')).toBe('☐ Corte aqui');
    expect(toggleTodo(toggleTodo('☐ A'))).toBe('☐ A');
  });

  it('todoSummary conta só as tarefas', () => {
    const s = todoSummary([{ label: '☐ a' }, { label: '☑ b' }, { label: 'comum' }, { label: '☑ c' }]);
    expect(s).toEqual({ total: 3, done: 2, open: 1 });
    expect(todoSummary([])).toEqual({ total: 0, done: 0, open: 0 });
  });
});
