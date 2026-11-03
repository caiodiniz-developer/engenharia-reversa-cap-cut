import { beforeEach, describe, expect, it } from 'vitest';
import { loadMediaView, mediaViewClasses, saveMediaView } from './mediaView';

beforeEach(() => localStorage.clear());

describe('modo de exibição da biblioteca', () => {
  it('o padrão é grade e a escolha da lista é lembrada', () => {
    expect(loadMediaView()).toBe('grid');
    saveMediaView('list');
    expect(loadMediaView()).toBe('list');
    saveMediaView('grid');
    expect(loadMediaView()).toBe('grid');
  });

  it('um valor desconhecido guardado volta para grade', () => {
    localStorage.setItem('editor.mediaView', 'mosaico');
    expect(loadMediaView()).toBe('grid');
  });

  it('cada modo tem classes próprias: grade em duas colunas, lista em coluna única com miniatura pequena', () => {
    const g = mediaViewClasses('grid');
    const l = mediaViewClasses('list');
    expect(g.list).toContain('grid-cols-2');
    expect(l.list).toContain('flex-col');
    expect(g.thumb).toContain('aspect-video');
    expect(l.thumb).toContain('w-20');
    expect(g).not.toEqual(l);
  });
});
