import { useEffect, useState, type RefObject } from 'react';

/** Posição de rolagem (px) de um contêiner, atualizada no máximo uma vez por quadro. */
export function useScrollTop(ref: RefObject<HTMLElement | null>): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTop(el.scrollTop));
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ref]);
  return top;
}
