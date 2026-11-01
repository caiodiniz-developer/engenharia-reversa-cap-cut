import { motion, useReducedMotion } from 'framer-motion';

/** Filete decorativo: as duas linhas se desenham e o ponto central surge quando entra na tela. */
export function AnimatedDivider() {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-5 py-2" aria-hidden="true" data-testid="divider">
      <svg viewBox="0 0 400 24" className="h-6 w-full max-w-md text-accent">
        <motion.path
          d="M0 12 H165 M235 12 H400"
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: reduce ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
        <motion.circle
          cx={200}
          cy={12}
          r={5}
          fill="currentColor"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ scale: reduce ? 1 : 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.5 }}
        />
      </svg>
    </div>
  );
}
