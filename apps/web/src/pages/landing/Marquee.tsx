import { EFFECTS, TRANSITION_TYPES } from '@editor/core';
import { TOOLS_MARQUEE } from './content';

const TRANSITION_LABEL: Record<string, string> = {
  fade: 'Dissolver',
  'slide-left': 'Deslizar ←',
  'slide-right': 'Deslizar →',
  'slide-up': 'Deslizar ↑',
  'slide-down': 'Deslizar ↓',
  'wipe-left': 'Cortina ←',
  'wipe-right': 'Cortina →',
};

/** Faixa que corre sem parar (pausa ao passar o mouse): a lista é repetida e a segunda cópia fica invisível a leitores de tela. */
function MarqueeRow({ items, label, testId, className }: { items: string[]; label: string; testId: string; className: string }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {items.map((name) => (
        <li key={name} className="whitespace-nowrap rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-medium text-mute">
          {name}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label={label} className={'marquee overflow-hidden ' + className} data-testid={testId}>
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

/** Nomes reais dos efeitos e transições do editor. */
export function Marquee() {
  const items = [...EFFECTS.map((e) => e.label), ...TRANSITION_TYPES.map((t) => TRANSITION_LABEL[t] ?? t)];
  return <MarqueeRow items={items} label="Efeitos e transições disponíveis" testId="marquee" className="pb-3 pt-8" />;
}

/** Ferramentas de edição do editor, na direção oposta à primeira faixa. */
export function ToolsMarquee() {
  return <MarqueeRow items={TOOLS_MARQUEE} label="Ferramentas de edição disponíveis" testId="marquee-tools" className="marquee-reverse pb-8" />;
}
