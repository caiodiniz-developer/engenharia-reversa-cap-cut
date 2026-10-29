/** Rola suavemente até uma seção da landing (instantâneo se o usuário pediu menos movimento). */
export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  // leva o foco para a seção, para quem navega por teclado ou leitor de tela
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
