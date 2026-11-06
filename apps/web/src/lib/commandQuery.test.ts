import { describe, expect, it } from 'vitest';
import { parseCommandQuery } from './commandQuery';

describe('parseCommandQuery', () => {
  it('separa o grupo do resto, sem acento e em minúsculas', () => {
    expect(parseCommandQuery('@Áudio fade longo')).toEqual({ group: 'audio', text: 'fade longo' });
    expect(parseCommandQuery('  @texto')).toEqual({ group: 'texto', text: '' });
  });

  it('sem @ no começo é busca comum', () => {
    expect(parseCommandQuery('dividir')).toEqual({ group: '', text: 'dividir' });
    expect(parseCommandQuery('e-mail a@b')).toEqual({ group: '', text: 'e-mail a@b' });
  });

  it('arroba sozinha ou seguida de espaço não filtra nada', () => {
    expect(parseCommandQuery('@')).toEqual({ group: '', text: '@' });
    expect(parseCommandQuery('@ audio')).toEqual({ group: '', text: '@ audio' });
    expect(parseCommandQuery('')).toEqual({ group: '', text: '' });
  });
});
