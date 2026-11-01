import type { RefObject } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { HERO } from './content';
import { ProductMock } from './ProductMock';
import { Magnetic } from './Magnetic';
import { RotatingWord } from './RotatingWord';
import { SplitText } from './SplitText';
import { Tilt } from './Tilt';
import { scrollToSection } from './scroll';

/** Primeira dobra: promessa, chamadas para cadastro/login e a ilustração do editor. */
export function Hero({ scroller }: { scroller?: RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll({ container: scroller });
  const orbA = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -110]);
  const orbB = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 70]);
  const fade = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: 'easeOut' as const } });
  return (
    <section
      className="relative overflow-hidden px-5 pb-20 pt-14 sm:pt-20"
      aria-labelledby="hero-title"
      data-testid="hero"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--cx', e.clientX - r.left + 'px');
        e.currentTarget.style.setProperty('--cy', e.clientY - r.top + 'px');
      }}
    >
      <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="hero-cursor" aria-hidden="true" />
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: orbA }} aria-hidden="true">
        <div className="hero-orb -left-24 top-10 h-72 w-72 bg-accent" />
      </motion.div>
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: orbB }} aria-hidden="true">
        <div className="hero-orb hero-orb-b -right-20 top-40 h-80 w-80 bg-clip-caption" />
      </motion.div>
      <div className="relative mx-auto max-w-3xl text-center">
        <motion.p {...fade(0)} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3.5 py-1.5 text-xs font-medium text-mute backdrop-blur">
          <Icon name="sparkles" size={13} className="text-accent" /> {HERO.eyebrow}
        </motion.p>
        <h1 id="hero-title" className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl" data-testid="hero-title">
          <SplitText text="Edite, revise e exporte seus vídeos" delay={0.05} /> <SplitText text="sem instalar nada." delay={0.42} wordClassName="gradient-text" />
        </h1>
        <motion.p {...fade(0.09)} className="mt-5 text-lg font-medium sm:text-xl">
          Faça <RotatingWord /> sem sair do navegador.
        </motion.p>
        <motion.p {...fade(0.12)} className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-mute sm:text-lg">
          {HERO.subtitle}
        </motion.p>
        <motion.div {...fade(0.2)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Magnetic>
            <Link to="/login?modo=cadastro" className="btn btn-primary btn-shine !h-12 px-7 text-[15px] shadow-lg" data-testid="hero-signup">
              {HERO.primary} <Icon name="chevronRight" size={16} />
            </Link>
          </Magnetic>
          <Magnetic>
            <Link to="/login" className="btn !h-12 px-7 text-[15px]" data-testid="hero-login">
              {HERO.secondary}
            </Link>
          </Magnetic>
        </motion.div>
        <motion.p {...fade(0.26)} className="mt-4 text-xs text-mute">
          {HERO.note}
        </motion.p>
        <motion.button {...fade(0.3)} type="button" className="mt-6 text-xs font-medium text-mute underline-offset-4 hover:text-ink hover:underline" onClick={() => scrollToSection('recursos')}>
          Ver o que dá para fazer ↓
        </motion.button>
      </div>

      <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.35, ease: 'easeOut' as const } })} className="relative mt-14">
        <Tilt>
          <ProductMock />
        </Tilt>
      </motion.div>
    </section>
  );
}
