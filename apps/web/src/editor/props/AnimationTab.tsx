import { sortKeyframes, type AnimatableProp, type Clip, type Easing, type Keyframe } from '@editor/core';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';

const PROPS: Array<{ prop: AnimatableProp; label: string; k: number; unit: string; step: number }> = [
  { prop: 'x', label: 'Posição X', k: 100, unit: '%', step: 1 },
  { prop: 'y', label: 'Posição Y', k: 100, unit: '%', step: 1 },
  { prop: 'scale', label: 'Escala', k: 100, unit: '%', step: 1 },
  { prop: 'rotation', label: 'Rotação', k: 1, unit: '°', step: 1 },
  { prop: 'opacity', label: 'Opacidade', k: 100, unit: '%', step: 1 },
  { prop: 'volume', label: 'Volume', k: 100, unit: '%', step: 1 },
];

const EASINGS: Array<{ value: Easing; label: string }> = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Suave' },
  { value: 'hold', label: 'Degrau' },
];

/** Lista e edita os keyframes do clipe, propriedade por propriedade. */
export function AnimationTab({ clip }: { clip: Clip }) {
  const patch = useEditor((s) => s.patchClip);
  const setPanel = useEditor((s) => s.setPanel);
  const applyAnimation = useEditor((s) => s.applyAnimation);
  const clear = useEditor((s) => s.clearAnimations);
  const entries = PROPS.filter((p) => (clip.keyframes[p.prop]?.length ?? 0) > 0 && (p.prop !== 'volume' || clip.type === 'media'));

  const setList = (prop: AnimatableProp, list: Keyframe[], label: string) =>
    patch(
      clip.id,
      (c) => {
        const kf = { ...c.keyframes };
        if (list.length) kf[prop] = sortKeyframes(list);
        else delete kf[prop];
        return { ...c, keyframes: kf } as Clip;
      },
      label,
      `kfedit:${prop}:${clip.id}`,
    );

  return (
    <div data-testid="animation-tab">
      <section className="border-b border-line/70 p-3">
        <h3 className="mb-2 text-xs font-semibold">Animações rápidas</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'fade-in', label: 'Aparecer' },
            { id: 'zoom-in', label: 'Zoom de entrada' },
            { id: 'fade-out', label: 'Desaparecer' },
            { id: 'ken-burns-in', label: 'Ken Burns' },
          ].map((a) => (
            <button key={a.id} type="button" className="btn !h-7 text-2xs" onClick={() => applyAnimation(clip.id, a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-2xs text-accent hover:underline"
          onClick={() => {
            setPanel('animations');
            window.dispatchEvent(new Event('editor:open-panel'));
          }}
        >
          Ver todas as animações…
        </button>
      </section>

      <section className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">Keyframes do clipe</h3>
          {entries.length > 0 && (
            <button type="button" className="text-2xs text-mute hover:text-danger" onClick={() => clear(clip.id)}>
              Remover todos
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-2xs leading-relaxed text-mute">
            Nenhuma propriedade animada. Use o losango <Icon name="diamond" size={10} className="inline" /> ao lado de um valor (aba Vídeo) ou aplique uma animação pronta.
          </p>
        ) : (
          entries.map(({ prop, label, k, unit, step }) => (
            <div key={prop} className="mb-4">
              <h4 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-mute">{label}</h4>
              <ul className="space-y-1">
                {clip.keyframes[prop]!.map((kf, i, list) => (
                  <li key={i} className="grid grid-cols-[58px_62px_minmax(0,1fr)_22px] items-center gap-1">
                    <input
                      className="field tnum h-7 px-1.5 text-right"
                      type="number"
                      step={0.05}
                      min={0}
                      max={clip.duration}
                      aria-label={`${label}: tempo do keyframe ${i + 1}`}
                      value={Number(kf.time.toFixed(3))}
                      onChange={(e) => setList(prop, list.map((x, j) => (j === i ? { ...x, time: Math.min(clip.duration, Math.max(0, Number(e.target.value))) } : x)), 'Tempo do keyframe')}
                    />
                    <div className="relative">
                      <input
                        className="field tnum h-7 pr-5 text-right"
                        type="number"
                        step={step}
                        aria-label={`${label}: valor do keyframe ${i + 1}`}
                        value={Number((kf.value * k).toFixed(3))}
                        onChange={(e) => setList(prop, list.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) / k } : x)), 'Valor do keyframe')}
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-2xs text-mute">{unit}</span>
                    </div>
                    <select
                      className="field h-7 px-1.5"
                      aria-label={`${label}: suavização do keyframe ${i + 1}`}
                      value={kf.easing}
                      onChange={(e) => setList(prop, list.map((x, j) => (j === i ? { ...x, easing: e.target.value as Easing } : x)), 'Suavização do keyframe')}
                    >
                      {EASINGS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-icon !h-6 !w-6" aria-label={`Remover keyframe ${i + 1} de ${label}`} onClick={() => setList(prop, list.filter((_, j) => j !== i), 'Remover keyframe')}>
                      <Icon name="x" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-2xs text-mute">Tempos em segundos desde o início do clipe.</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
