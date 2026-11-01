import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { makeParticles, stepParticles } from './confetti';

/** Canvas sobre o elemento pai. Cada vez que ${fire} muda para um número maior que zero, solta confete e para quando todas as partículas somem. */
export function Confetti({ fire, origin = { x: 0.2, y: 0.8 } }: { fire: number; origin?: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [fired, setFired] = useState(0);

  useEffect(() => {
    if (!fire || reduce) return;
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = w;
    canvas.height = h;
    let ps = makeParticles(110, fire * 7919, { x: w * origin.x, y: h * origin.y });
    setFired(fire);
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ps = stepParticles(ps, dt);
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = 'hsl(' + p.hue + ' 85% 60%)';
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (ps.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, reduce]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full" data-testid="confetti" data-fired={fired} />;
}
