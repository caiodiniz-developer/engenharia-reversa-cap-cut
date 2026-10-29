import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const ROTATING_WORDS = ['legendas', 'cortes', 'efeitos', 'animações', 'transições', 'trilhas de áudio'];

/** Palavra que troca sozinha a cada poucos segundos (fica parada na primeira com "menos movimento"). */
export function RotatingWord({ words = ROTATING_WORDS, interval = 2200 }: { words?: string[]; interval?: number }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || words.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [reduce, words.length, interval]);
  return (
    <span className="relative inline-flex h-[1.35em] min-w-[7ch] items-center justify-center overflow-hidden align-bottom" data-testid="rotating-word" aria-live="off">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={words[i]} initial={reduce ? false : { y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: '-100%', opacity: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="gradient-text font-semibold">
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
