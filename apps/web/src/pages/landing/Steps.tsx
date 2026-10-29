import { motion, useReducedMotion } from 'framer-motion';
import { STEPS } from './content';

/** Três passos: criar a conta, montar e revisar/exportar. */
export function Steps() {
  const reduce = useReducedMotion();
  return (
    <ol className="relative grid gap-6 md:grid-cols-3" data-testid="steps">
      <span className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" aria-hidden="true" />
      {STEPS.map((s, i) => (
        <motion.li key={s.n} {...(reduce ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.45, delay: i * 0.1 } })} className="relative text-center">
          <span className="relative mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-bg text-lg font-bold text-accent shadow-sm">{s.n}</span>
          <h3 className="mb-2 text-base font-semibold">{s.title}</h3>
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-mute">{s.text}</p>
        </motion.li>
      ))}
    </ol>
  );
}
