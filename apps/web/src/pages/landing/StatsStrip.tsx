import { useRef } from 'react';
import { useCountUp, useInView } from './anim';
import { liveStats, type Stat } from './content';

function Counter({ stat, active }: { stat: Stat; active: boolean }) {
  const value = useCountUp(Number(stat.value), active);
  return (
    <div>
      {/* o valor final fica no data-value para leitores de tela e testes; o número visível sobe animado */}
      <dd className="tnum text-3xl font-bold tracking-tight" data-value={stat.value} aria-label={stat.value}>
        {value}
      </dd>
      <dt className="mt-1 text-xs text-mute">{stat.label}</dt>
    </div>
  );
}

/** Faixa de números reais do editor; cada número sobe até o valor quando a faixa aparece na tela. */
export function StatsStrip() {
  const ref = useRef<HTMLDListElement>(null);
  const active = useInView(ref);
  return (
    <section aria-label="O editor em números" className="border-y border-line bg-panel/60 px-5 py-10" data-testid="stats">
      <dl ref={ref} className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-6">
        {liveStats().map((s) => (
          <Counter key={s.label} stat={s} active={active} />
        ))}
      </dl>
    </section>
  );
}
