const KEY = 'editor.rememberedEmail';
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail guardado, ou texto vazio se não houver, se estiver malformado ou se o armazenamento não estiver disponível. */
export function loadRememberedEmail(): string {
  try {
    const v = (localStorage.getItem(KEY) ?? '').trim();
    return SIMPLE_EMAIL.test(v) && v.length <= 254 ? v : '';
  } catch {
    return '';
  }
}

export function saveRememberedEmail(email: string): void {
  const v = email.trim();
  if (!SIMPLE_EMAIL.test(v) || v.length > 254) return;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

export function clearRememberedEmail(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
