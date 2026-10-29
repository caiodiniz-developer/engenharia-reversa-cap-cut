import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';
import { Icon } from '../../components/Icon';
import { useScrollTop } from './useScrollTop';

/** Botão flutuante que leva ao topo; só aparece depois de rolar bastante. */
export function BackToTop({ container }: { container: RefObject<HTMLElement | null> }) {
  const top = useScrollTop(container);
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <AnimatePresence>
      {top > 700 && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-ink shadow-pop hover:bg-panel-3 max-md:bottom-20"
          aria-label="Voltar ao topo"
          data-testid="back-to-top"
          onClick={() => container.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
        >
          <Icon name="chevronUp" size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
