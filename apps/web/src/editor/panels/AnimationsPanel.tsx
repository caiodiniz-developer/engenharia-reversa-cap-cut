import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ANIMATION_PRESETS, findClip, type AnimationKind, type AnimationPreset, type Keyframe } from '@editor/core';
import { NumberField } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const GROUPS: Array<{ kind: AnimationKind; title: string; hint: string }> = [
  { kind: 'in', title: 'Entrada', hint: 'Acontece nos primeiros segundos do clipe' },
  { kind: 'out', title: 'Saída', hint: 'Acontece nos últimos segundos do clipe' },
  { kind: 'whole', title: 'Movimento e ênfase', hint: 'Dura o clipe inteiro' },
];

const DEMO_SECONDS = 2;

/** Converte os keyframes reais do preset em uma animação de miniatura (a mesma curva que será aplicada). */
function demoProps(p: AnimationPreset) {
  const built = p.build({ clipDuration: DEMO_SECONDS, duration: Math.min(p.defaultDuration || 1, 1) });
  const animate: Record<string, number[]> = {};
  const transition: Record<string, { times: number[]; duration: number; ease: 'linear'; repeat: number; repeatDelay: number }> = {};
  const map = { x: ['x', 120], y: ['y', 70], scale: ['scale', 1], rotation: ['rotate', 1], opacity: ['opacity', 1] } as const;
  for (const [prop, kfs] of Object.entries(built.keyframes) as Array<[keyof typeof map, Keyframe[]]>) {
    if (!kfs?.length) continue;
    const [key, k] = map[prop];
    const pts = [...kfs].sort((a, b) => a.time - b.time);
    // Os quadros-chave precisam cobrir [0, 1] para o framer-motion; mantém o primeiro/último valor nas pontas.
    const times = pts.map((q) => Math.min(1, q.time / DEMO_SECONDS));
    const values = pts.map((q) => q.value * k);
    if (times[0]! > 0) {
      times.unshift(0);
      values.unshift(values[0]!);
    }
    if (times[times.length - 1]! < 1) {
      times.push(1);
      values.push(values[values.length - 1]!);
    }
    animate[key] = values;
    transition[key] = { times, duration: DEMO_SECONDS, ease: 'linear', repeat: Infinity, repeatDelay: 0.5 };
  }
  return { animate, transition, baseScale: built.transform?.scale ?? 1 };
}

function Demo({ preset }: { preset: AnimationPreset }) {
  const d = useMemo(() => demoProps(preset), [preset]);
  return (
    <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-bg" aria-hidden="true">
      <motion.div className="h-7 w-10 rounded-md bg-gradient-to-br from-accent to-sky-500 shadow" style={{ scale: d.baseScale }} animate={d.animate} transition={d.transition as never} />
    </div>
  );
}

export function AnimationsPanel() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const apply = useEditor((s) => s.applyAnimation);
  const clear = useEditor((s) => s.clearAnimations);
  const [duration, setDuration] = useState(0.6);

  const clips = selection.map((id) => findClip(project, id)?.clip).filter((c) => c && (c.type === 'media' || c.type === 'text' || c.type === 'caption'));
  const visual = clips.filter((c) => c && (c.type !== 'media' || project.tracks.find((t) => t.clips.includes(c))?.kind === 'video'));
  const withKeyframes = visual.some((c) => c && Object.values(c.keyframes).some((k) => k && k.length));

  const run = (presetId: string) => {
    if (!visual.length) return toast.info('Selecione um clipe de vídeo, imagem ou texto na timeline');
    for (const c of visual) if (c) apply(c.id, presetId, duration);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <NumberField label="Duração" value={duration} onChange={setDuration} min={0.2} max={2} step={0.05} unit="s" />
        <p className="text-2xs leading-relaxed text-mute">A duração vale para entradas e saídas. As animações viram keyframes comuns: dá para ajustar cada um depois na aba Animação das propriedades.</p>
        <button type="button" className="btn w-full" disabled={!withKeyframes} onClick={() => visual.forEach((c) => c && clear(c.id))}>
          <Icon name="x" size={13} /> Remover animações do clipe
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!visual.length && <p className="mb-3 rounded-lg bg-panel-3 px-3 py-2 text-2xs text-mute">Selecione um clipe na timeline para aplicar.</p>}
        {GROUPS.map((g) => (
          <section key={g.kind} className="mb-5">
            <h3 className="px-0.5 text-xs font-semibold">{g.title}</h3>
            <p className="mb-2 px-0.5 text-2xs text-mute">{g.hint}</p>
            <ul className="grid grid-cols-2 gap-2">
              {ANIMATION_PRESETS.filter((p) => p.kind === g.kind).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => run(p.id)} className="card card-hover block w-full overflow-hidden p-1.5 text-left" title={p.description} aria-label={`Animação ${p.label}`}>
                    <Demo preset={p} />
                    <span className="mt-1.5 block truncate px-1 text-xs font-medium">{p.label}</span>
                    <span className="block truncate px-1 pb-0.5 text-2xs text-mute">{p.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
