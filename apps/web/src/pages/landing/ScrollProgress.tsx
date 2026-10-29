import { motion, useScroll, useSpring } from 'framer-motion';
import type { RefObject } from 'react';

/** Barra fina no topo que mostra quanto da página já foi lida. */
export function ScrollProgress({ container }: { container: RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ container });
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.4 });
  return <motion.div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-accent via-sky-400 to-clip-caption" style={{ scaleX }} aria-hidden="true" data-testid="scroll-progress" />;
}
