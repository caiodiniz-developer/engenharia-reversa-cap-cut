import { useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Desaceleração suave no fim (cúbica). `t` de 0 a 1. */
export const easeOutCubic = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Valor intermediário entre `from` e `to` para um progresso `t` (0–1), arredondado para inteiro. */
export function countAt(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * easeOutCubic(t));
}

/** `true` quando o elemento aparece na tela (uma vez, por padrão). Sem IntersectionObserver, já conta como visível. */
export function useInView<T extends Element>(ref: RefObject<T | null>, once = true): boolean {
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          if (once) io.disconnect();
        } else if (!once) setSeen(false);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once]);
  return seen;
}

/**
 * Número que sobe (ou desce) até `target` em `ms` milissegundos quando `active` fica verdadeiro.
 * Com "menos movimento" pulamos a animação e mostramos o valor final.
 */
export function useCountUp(target: number, active: boolean, ms = 1200): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const from = useRef(reduce ? target : 0);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = countAt(base, target, t);
      setValue(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms, reduce]);
  return value;
}
