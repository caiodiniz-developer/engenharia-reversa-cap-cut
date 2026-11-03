import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PINS, loadPins, pinnedFirst, savePins, togglePin } from './pins';

beforeEach(() => localStorage.clear());

describe('togglePin', () => {
  it('fixa pela frente e desafixa se já estava', () => {
    expect(togglePin([], 'a')).toEqual(['a']);
    expect(togglePin(['a'], 'b')).toEqual(['b', 'a']);
    expect(togglePin(['b', 'a'], 'a')).toEqual(['b']);
  });

  it('respeita o limite: o mais antigo sai', () => {
    let pins: string[] = [];
    for (let i = 0; i < MAX_PINS + 3; i++) pins = togglePin(pins, 'p' + i);
    expect(pins).toHaveLength(MAX_PINS);
    expect(pins[0]).toBe('p' + (MAX_PINS + 2));
    expect(pins).not.toContain('p0');
  });
});

describe('pinnedFirst', () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  it('fixados primeiro, na ordem de fixação; os outros mantêm a ordem', () => {
    expect(pinnedFirst(list, ['c', 'a']).map((p) => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('sem fixados ou com ids que não existem, a lista fica igual', () => {
    expect(pinnedFirst(list, []).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(pinnedFirst(list, ['zzz']).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('armazenamento', () => {
  it('guarda e lê de volta', () => {
    savePins(['x', 'y']);
    expect(loadPins()).toEqual(['x', 'y']);
  });

  it('JSON quebrado, formato errado e itens que não são texto viram lista válida', () => {
    localStorage.setItem('editor.pinnedProjects', '{quebrado');
    expect(loadPins()).toEqual([]);
    localStorage.setItem('editor.pinnedProjects', '{"a":1}');
    expect(loadPins()).toEqual([]);
    localStorage.setItem('editor.pinnedProjects', '["a", 3, null, "a", "b"]');
    expect(loadPins()).toEqual(['a', 'b']);
  });
});
