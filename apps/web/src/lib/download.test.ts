import { describe, expect, it } from 'vitest';
import { fileBase } from './download';

describe('fileBase', () => {
  it('troca espaços e símbolos por sublinhado, mantém acentos e tira sublinhados das pontas', () => {
    expect(fileBase('Meu vídeo: final?')).toBe('Meu_vídeo_final');
    expect(fileBase('  ação-1  ')).toBe('ação-1');
  });

  it('usa o nome reserva quando nada sobra', () => {
    expect(fileBase('???')).toBe('projeto');
    expect(fileBase('', 'roteiro')).toBe('roteiro');
  });
});
