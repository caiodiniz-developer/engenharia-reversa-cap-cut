import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { PacingDemo } from './demo/PacingDemo';
import { ReviewDemo } from './demo/ReviewDemo';
import { SafeZonesDemo } from './demo/SafeZonesDemo';
import { VisionDemo } from './demo/VisionDemo';

export interface LabTab {
  id: string;
  label: string;
  icon: IconName;
  hint: string;
  render(): ReactNode;
}

export const LAB_TABS: LabTab[] = [
  { id: 'revisao', label: 'Revisão ao vivo', icon: 'check', hint: 'Corrija os problemas e veja a nota subir.', render: () => <ReviewDemo /> },
  { id: 'zonas', label: 'Zonas seguras', icon: 'layout', hint: 'Mova a legenda e veja o que a plataforma cobre.', render: () => <SafeZonesDemo /> },
  { id: 'ritmo', label: 'Ritmo da edição', icon: 'gauge', hint: 'Arraste a duração dos planos e veja o ritmo.', render: () => <PacingDemo /> },
  { id: 'visao', label: 'Daltonismo', icon: 'eye', hint: 'Veja a mesma paleta com outros tipos de visão.', render: () => <VisionDemo /> },
];

/**
 * Laboratório interativo: quatro demonstrações que rodam o mesmo código do editor (revisão, zonas seguras, ritmo e simulação
 * de visão) direto na página, sem precisar de conta. As abas seguem o padrão WAI-ARIA (setas, Home e End).
 */
export function LabSection() {
  const reduce = useReducedMotion();
  const base = useId();
  const [active, setActive] = useState(LAB_TABS[0]!.id);
  const current = LAB_TABS.find((t) => t.id === active)!;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = LAB_TABS.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(LAB_TABS[next]!.id);
    document.getElementById(`${base}-tab-${LAB_TABS[next]!.id}`)?.focus();
  };

  return (
    <div data-testid="lab">
      <div role="tablist" aria-label="Demonstrações" className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-2">
        {LAB_TABS.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              id={`${base}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              data-testid={`lab-tab-${t.id}`}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`relative flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${on ? 'border-accent text-accent' : 'border-line text-mute hover:text-ink'}`}
            >
              {on && <motion.span layoutId={reduce ? undefined : `${base}-pill`} className="absolute inset-0 rounded-full bg-accent/12" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <Icon name={t.icon} size={14} className="relative" />
              <span className="relative">{t.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-6 text-center text-sm text-mute" data-testid="lab-hint">
        {current.hint}
      </p>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${active}`} className="mx-auto max-w-5xl rounded-3xl border border-line bg-panel/70 p-5 shadow-pop backdrop-blur sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={active} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {current.render()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
