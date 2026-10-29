import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';

/** Inclinação 3D suave que segue o mouse (no máximo `max` graus). Sem efeito em telas de toque ou com menos movimento. */
export function Tilt({ children, max = 5 }: { children: ReactNode; max?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 140, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 140, damping: 18 });
  if (reduce) return <>{children}</>;
  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
        }}
        data-testid="tilt"
      >
        {children}
      </motion.div>
    </div>
  );
}
