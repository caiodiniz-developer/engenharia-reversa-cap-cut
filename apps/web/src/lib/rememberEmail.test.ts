import { beforeEach, describe, expect, it } from 'vitest';
import { clearRememberedEmail, loadRememberedEmail, saveRememberedEmail } from './rememberEmail';

beforeEach(() => localStorage.clear());

describe('e-mail lembrado no login', () => {
  it('começa vazio, guarda sem espaços nas pontas e limpa', () => {
    expect(loadRememberedEmail()).toBe('');
    saveRememberedEmail('  ana@exemplo.com ');
    expect(loadRememberedEmail()).toBe('ana@exemplo.com');
    clearRememberedEmail();
    expect(loadRememberedEmail()).toBe('');
  });

  it('não guarda texto que não é e-mail e ignora lixo que já estava guardado', () => {
    saveRememberedEmail('isso não é um e-mail');
    expect(loadRememberedEmail()).toBe('');
    localStorage.setItem('editor.rememberedEmail', '<script>alert(1)</script>');
    expect(loadRememberedEmail()).toBe('');
    saveRememberedEmail('a@b.co');
    saveRememberedEmail('invalido');
    expect(loadRememberedEmail()).toBe('a@b.co'); // o inválido não sobrescreve
  });

  it('só existe uma chave no armazenamento e nada parecido com senha', () => {
    saveRememberedEmail('ana@exemplo.com');
    expect(Object.keys(localStorage)).toEqual(['editor.rememberedEmail']);
  });
});
