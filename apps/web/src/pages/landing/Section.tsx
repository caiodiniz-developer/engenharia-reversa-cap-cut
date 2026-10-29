import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Bloco de seção da landing: id (âncora), título, subtítulo e revelação suave ao rolar. */
export function LandingSection({ id, eyebrow, title, subtitle, children, tone = 'plain' }: { id: string; eyebrow?: string; title: string; subtitle?: string; children: ReactNode; tone?: 'plain' | 'tinted' }) {
  const reduce = useReducedMotion();
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-20 px-5 py-20 outline-none sm:py-24 ${tone === 'tinted' ? 'border-y border-line bg-panel/60' : ''}`}>
      <div className="mx-auto max-w-6xl">
        <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.5 } })} className="mx-auto mb-12 max-w-2xl text-center">
          {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
          <h2 id={`${id}-title`} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {subtitle && <p className="mt-4 text-balance text-base leading-relaxed text-mute">{subtitle}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  );
}
