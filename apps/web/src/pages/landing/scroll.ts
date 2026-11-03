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


/**
 * Seção "atual" para destacar no menu: a última cuja borda de cima já passou de ${offset} px abaixo do topo da área rolável.
 * ${tops} vem na ordem em que as seções aparecem na página; antes da primeira não há seção atual (null).
 */
export function activeSectionId(tops: Array<{ id: string; top: number }>, offset: number): string | null {
  let current: string | null = null;
  for (const s of tops) if (s.top <= offset) current = s.id;
  return current;
}


/** Leva a área rolável da landing de volta ao topo. Com "menos movimento", o salto é instantâneo. */
export function scrollToTop(el: Pick<HTMLElement, 'scrollTo'> | null, reduceMotion: boolean): void {
  el?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}
