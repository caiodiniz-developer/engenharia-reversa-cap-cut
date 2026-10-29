import { EFFECTS, TRANSITION_TYPES } from '@editor/core';

const TRANSITION_LABEL: Record<string, string> = {
  fade: 'Dissolver',
  'slide-left': 'Deslizar ←',
  'slide-right': 'Deslizar →',
  'slide-up': 'Deslizar ↑',
  'slide-down': 'Deslizar ↓',
  'wipe-left': 'Cortina ←',
  'wipe-right': 'Cortina →',
};

/** Nomes reais dos efeitos e transições do editor, em uma faixa que corre sem parar (pausa ao passar o mouse). */
export function Marquee() {
  const items = [...EFFECTS.map((e) => e.label), ...TRANSITION_TYPES.map((t) => TRANSITION_LABEL[t] ?? t)];
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
    <section aria-label="Efeitos e transições disponíveis" className="marquee overflow-hidden py-8" data-testid="marquee">
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
