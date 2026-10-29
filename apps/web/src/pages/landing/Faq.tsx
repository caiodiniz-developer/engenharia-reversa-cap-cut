import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { FAQ } from './content';

/** Perguntas frequentes em acordeão; só uma resposta aberta por vez, com navegação por teclado nativa dos botões. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-panel" data-testid="faq">
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <h3>
              <button type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium hover:bg-panel-3/60" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                {f.q}
                <Icon name="chevronDown" size={16} className={`shrink-0 text-mute transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!isOpen} className="px-5 pb-5 text-sm leading-relaxed text-mute">
              {f.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
