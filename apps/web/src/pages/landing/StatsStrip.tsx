import { liveStats } from './content';

/** Faixa de números reais do editor (efeitos, LUTs, transições, animações, verificações e plataformas). */
export function StatsStrip() {
  const stats = liveStats();
  return (
    <section aria-label="O editor em números" className="border-y border-line bg-panel/60 px-5 py-10" data-testid="stats">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label}>
            <dd className="tnum text-3xl font-bold tracking-tight">{s.value}</dd>
            <dt className="mt-1 text-xs text-mute">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
