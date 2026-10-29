import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../../components/Icon';
import type { Feature } from './content';

/** Grade de cartões (ícone, título, texto) com entrada escalonada ao rolar. */
export function FeatureGrid({ items, testId, columns = 3 }: { items: Feature[]; testId: string; columns?: 3 | 4 }) {
  const reduce = useReducedMotion();
  return (
    <ul className={`grid gap-4 sm:grid-cols-2 ${columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`} data-testid={testId}>
      {items.map((f, i) => (
        <motion.li
          key={f.title}
          {...(reduce ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.45, delay: (i % 3) * 0.06 } })}
          className="card card-hover spotlight group p-5"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--mx', e.clientX - r.left + 'px');
            e.currentTarget.style.setProperty('--my', e.clientY - r.top + 'px');
          }}
          data-testid="feature-card"
        >
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent transition-transform group-hover:scale-110">
            <Icon name={f.icon} size={20} />
          </span>
          <h3 className="mb-1.5 text-[15px] font-semibold">{f.title}</h3>
          <p className="text-[13px] leading-relaxed text-mute">{f.text}</p>
        </motion.li>
      ))}
    </ul>
  );
}
