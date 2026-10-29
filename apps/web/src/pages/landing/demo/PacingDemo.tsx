import { useMemo, useState } from 'react';
import { formatDuration } from '../../../lib/format';
import { DEMO_TOTAL, pacingDemoState, shotLengths } from './pacingModel';

const SEG = ['bg-clip-video', 'bg-sky-500'];
const comma = (n: number) => String(n).replace('.', ',');

/** Arraste a duração média dos planos e veja o ritmo de um vídeo de 30 s, com as estatísticas do próprio editor. */
export function PacingDemo() {
  const [avg, setAvg] = useState(3);
  const { stats, label, curve } = useMemo(() => pacingDemoState(avg), [avg]);
  const lengths = useMemo(() => shotLengths(avg), [avg]);
  const max = Math.max(1, ...curve);
  const cards: Array<[string, string, string?]> = [
    ['Ritmo', label, 'demo-pacing-label'],
    ['Planos', String(stats.shots), 'demo-shots'],
    ['Cortes por minuto', comma(stats.cutsPerMinute)],
    ['Mediana', comma(stats.median) + ' s'],
  ];
  return (
    <div data-testid="demo-pacing">
      <label className="label" htmlFor="demo-avg">
        Duração média dos planos:{' '}
        <strong className="tnum text-ink" data-testid="demo-avg-value">
          {comma(avg)} s
        </strong>
      </label>
      <input id="demo-avg" type="range" min={0.8} max={10} step={0.1} value={avg} onChange={(e) => setAvg(Number(e.target.value))} className="mb-6 w-full" data-testid="demo-avg" />

      <div className="mb-6 flex h-10 overflow-hidden rounded-lg border border-line bg-bg" aria-label={`Vídeo de ${DEMO_TOTAL} segundos dividido em ${lengths.length} planos`} role="img">
        {lengths.map((l, i) => (
          <span key={i} className={`h-full border-r border-bg ${SEG[i % 2]} transition-[width] duration-300`} style={{ width: (l / DEMO_TOTAL) * 100 + '%' }} />
        ))}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([k, v, id]) => (
          <div key={k} className="rounded-xl border border-line bg-panel p-3 text-center">
            <dt className="text-[10px] uppercase tracking-wide text-mute">{k}</dt>
            <dd className="mt-1 text-lg font-bold" data-testid={id}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mb-1.5 text-xs font-medium text-mute">Cortes a cada 5 segundos</p>
      <div className="flex h-16 items-end gap-1.5 rounded-lg border border-line bg-bg p-2" role="img" aria-label="Mapa de ritmo">
        {curve.map((n, i) => (
          <span key={i} className={`flex-1 rounded-sm transition-[height] duration-300 ${n === 0 ? 'bg-line' : 'bg-accent'}`} style={{ height: Math.max(4, (n / max) * 100) + '%' }} title={`${formatDuration(i * 5)}: ${n} ${n === 1 ? 'corte' : 'cortes'}`} />
        ))}
      </div>
    </div>
  );
}
