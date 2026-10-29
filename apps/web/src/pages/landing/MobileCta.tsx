import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useScrollTop } from './useScrollTop';

/** Barra de cadastro fixa no rodapé em telas pequenas, depois que o topo da página saiu de vista. */
export function MobileCta({ container }: { container: RefObject<HTMLElement | null> }) {
  const top = useScrollTop(container);
  return (
    <AnimatePresence>
      {top > 520 && (
        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-md md:hidden" data-testid="mobile-cta">
          <p className="min-w-0 flex-1 text-xs leading-snug text-mute">Edite no navegador, sem instalar nada.</p>
          <Link to="/login?modo=cadastro" className="btn btn-primary !h-10 shrink-0 px-5 text-sm">
            Criar conta
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
