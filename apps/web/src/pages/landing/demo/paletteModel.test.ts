import { describe, expect, it } from 'vitest';
import { demoCommands, POPULAR, searchDemo, typewriterFrame } from './paletteModel';

describe('demonstração da paleta de comandos', () => {
  it('usa a lista real de comandos do editor (dezenas de ações)', () => {
    expect(demoCommands().length).toBeGreaterThan(80);
  });

  it('busca sem acento como no editor: "dividir" acha o corte e "exportar" acha a exportação', () => {
    expect(searchDemo('dividir').some((c) => c.id === 'split')).toBe(true);
    expect(searchDemo('EXPORTAR').some((c) => c.id === 'export')).toBe(true);
    expect(searchDemo('animacoes').some((c) => c.id === 'open-animations')).toBe(true);
  });

  it('sem texto mostra os populares que existem e respeita o limite', () => {
    const base = searchDemo('');
    expect(base.map((c) => c.id)).toEqual(POPULAR);
    expect(searchDemo('', 3)).toHaveLength(3);
    expect(searchDemo('zzzzz-nada')).toEqual([]);
  });

  it('cada resultado traz rótulo, grupo e ícone para desenhar a linha', () => {
    for (const c of searchDemo('zoom')) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.group.length).toBeGreaterThan(2);
      expect(c.icon).toBeTruthy();
    }
  });
});

describe('typewriterFrame', () => {
  const words = ['ab', 'xyz'];

  it('digita letra a letra, espera e apaga, em ciclo', () => {
    const frames = Array.from({ length: 2 * 2 + 8 + 3 * 2 + 8 }, (_, t) => typewriterFrame(words, t, 8));
    expect(frames.slice(0, 3)).toEqual(['a', 'ab', 'ab']); // digita e começa a segurar
    expect(frames[2 + 8 - 1]).toBe('ab'); // ainda parado no fim da espera
    expect(frames[2 + 8]).toBe('a'); // começou a apagar
    expect(frames[2 + 8 + 1]).toBe(''); // apagou tudo
    const startOfSecond = 2 * 2 + 8;
    expect(frames[startOfSecond]).toBe('x');
    expect(frames[startOfSecond + 2]).toBe('xyz');
  });

  it('é periódico e aceita instantes negativos', () => {
    const period = (2 * 2 + 8) + (3 * 2 + 8);
    for (let t = 0; t < period; t++) expect(typewriterFrame(words, t + period, 8)).toBe(typewriterFrame(words, t, 8));
    expect(typeof typewriterFrame(words, -5, 8)).toBe('string');
    expect(typewriterFrame([], 3)).toBe('');
  });
});
