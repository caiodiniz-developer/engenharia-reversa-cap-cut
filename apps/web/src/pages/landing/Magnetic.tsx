import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { magnetOffset } from './magnet';

/** Envolve um botão: com o mouse por perto ele é puxado levemente na direção do cursor e volta com mola. Parado com menos movimento e em toque. */
export function Magnetic({ children, radius = 130, strength = 0.35 }: { children: ReactNode; radius?: number; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      // O retângulo já inclui o deslocamento atual; tira-se para o centro de referência não "fugir" do cursor.
      const cx = r.left + r.width / 2 - x.get();
      const cy = r.top + r.height / 2 - y.get();
      const o = magnetOffset(e.clientX - cx, e.clientY - cy, radius, strength);
      x.set(o.x);
      y.set(o.y);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, radius, strength, x, y]);

  return (
    <motion.span ref={ref} style={{ x: sx, y: sy, display: 'inline-block' }} data-testid="magnetic">
      {children}
    </motion.span>
  );
}
