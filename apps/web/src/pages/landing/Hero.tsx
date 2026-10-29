import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { HERO } from './content';
import { ProductMock } from './ProductMock';
import { RotatingWord } from './RotatingWord';
import { scrollToSection } from './scroll';

/** Primeira dobra: promessa, chamadas para cadastro/login e a ilustração do editor. */
export function Hero() {
  const reduce = useReducedMotion();
  const fade = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: 'easeOut' as const } });
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-14 sm:pt-20" aria-labelledby="hero-title" data-testid="hero">
      <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl text-center">
        <motion.p {...fade(0)} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3.5 py-1.5 text-xs font-medium text-mute backdrop-blur">
          <Icon name="sparkles" size={13} className="text-accent" /> {HERO.eyebrow}
        </motion.p>
        <motion.h1 {...fade(0.05)} id="hero-title" className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
          Edite, revise e exporte seus vídeos <span className="gradient-text">sem instalar nada.</span>
        </motion.h1>
        <motion.p {...fade(0.09)} className="mt-5 text-lg font-medium sm:text-xl">
          Faça <RotatingWord /> sem sair do navegador.
        </motion.p>
        <motion.p {...fade(0.12)} className="mx-auto mt-4 max-w-2xl text-balance text-base leading-relaxed text-mute sm:text-lg">
          {HERO.subtitle}
        </motion.p>
        <motion.div {...fade(0.2)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login?modo=cadastro" className="btn btn-primary !h-12 px-7 text-[15px] shadow-lg" data-testid="hero-signup">
            {HERO.primary} <Icon name="chevronRight" size={16} />
          </Link>
          <Link to="/login" className="btn !h-12 px-7 text-[15px]" data-testid="hero-login">
            {HERO.secondary}
          </Link>
        </motion.div>
        <motion.p {...fade(0.26)} className="mt-4 text-xs text-mute">
          {HERO.note}
        </motion.p>
        <motion.button {...fade(0.3)} type="button" className="mt-6 text-xs font-medium text-mute underline-offset-4 hover:text-ink hover:underline" onClick={() => scrollToSection('recursos')}>
          Ver o que dá para fazer ↓
        </motion.button>
      </div>

      <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.35, ease: 'easeOut' as const } })} className="relative mt-14">
        <ProductMock />
      </motion.div>
    </section>
  );
}
