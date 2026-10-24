import { AnimatePresence, motion } from 'framer-motion';
import { useToasts } from '../store/toasts';
import { Icon } from './Icon';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.16 }}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-panel2 px-3 py-2.5 text-xs shadow-xl ${
              t.kind === 'error' ? 'border-danger/50' : t.kind === 'success' ? 'border-ok/50' : 'border-line'
            }`}
          >
            <span className={t.kind === 'error' ? 'text-danger' : t.kind === 'success' ? 'text-ok' : 'text-accent'}>
              <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'sparkles'} />
            </span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button type="button" className="text-mute hover:text-ink" aria-label="Dispensar" onClick={() => dismiss(t.id)}>
              <Icon name="x" size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
