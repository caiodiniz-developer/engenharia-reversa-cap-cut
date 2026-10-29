import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { useRef, useState, type RefObject } from 'react';
import { STEPS } from './content';

/** Maior passo (0-based) alcançado para um progresso de 0 a 1; o passo i acende em (i + 0,35) ÷ total. −1 se nenhum. */
export function reachedStep(progress: number, count: number): number {
  const p = Math.min(1, Math.max(0, progress));
  let reached = -1;
  for (let i = 0; i < count; i++) if (p >= (i + 0.35) / count) reached = i;
  return reached;
}

/**
 * Três passos ligados por uma linha que vai se preenchendo conforme a seção é rolada; cada passo acende quando a linha o alcança.
 * Com "menos movimento" a linha e os passos já aparecem completos.
 */
export function Steps({ container }: { container: RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, container, offset: ['start 85%', 'end 55%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const [reached, setReached] = useState(reduce ? STEPS.length - 1 : -1);
  useMotionValueEvent(scrollYProgress, 'change', (v) => !reduce && setReached(reachedStep(v, STEPS.length)));

  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-3 md:gap-6" data-testid="steps">
      <span className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-0.5 rounded bg-line md:block" aria-hidden="true" />
      <motion.span className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-0.5 origin-left rounded bg-gradient-to-r from-accent to-sky-400 md:block" style={{ scaleX: reduce ? 1 : fill }} aria-hidden="true" data-testid="steps-line" />
      {STEPS.map((s, i) => {
        const on = i <= reached;
        return (
          <li key={s.n} className="relative text-center" data-testid="step" data-active={on}>
            <span className={`relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold transition-all duration-500 ${on ? 'scale-110 border-accent bg-accent text-accent-ink shadow-[0_0_24px_rgb(var(--accent)/0.45)]' : 'border-line bg-bg text-mute'}`}>{s.n}</span>
            <h3 className={`mb-2 text-base font-semibold transition-colors duration-500 ${on ? '' : 'text-mute'}`}>{s.title}</h3>
            <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-mute">{s.text}</p>
          </li>
        );
      })}
    </ol>
  );
}
