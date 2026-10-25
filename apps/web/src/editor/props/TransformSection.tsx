import type { Clip, MediaClip, TextClip, CaptionClip } from '@editor/core';
import { Check, NumberField, Section } from '../../components/controls';
import { useEditor } from '../../store/editor';
import { KeyframeButton, setAnimatable, valueAt } from './shared';

type Visual = MediaClip | TextClip | CaptionClip;

/** Posição, escala, rotação, opacidade, espelhamento e recorte — comum a mídia, texto e legendas. */
export function TransformSection({ clips }: { clips: Visual[] }) {
  const clip = clips[0]!;
  const playhead = useEditor((s) => s.playhead);
  const patch = useEditor((s) => s.patchClip);
  const t = clip.transform;
  const all = (fn: (c: Visual) => Visual, label: string, key: string) => clips.forEach((c) => patch(c.id, (x) => fn(x as Visual) as Clip, label, `${key}:${c.id}`));

  const num = (prop: 'x' | 'y' | 'scale' | 'rotation' | 'opacity', label: string, min: number, max: number, step: number, unit: string, k: number) => (
    <NumberField
      label={label}
      value={valueAt(clip, prop, playhead) * k}
      min={min}
      max={max}
      step={step}
      unit={unit}
      right={<KeyframeButton clip={clip} prop={prop} />}
      onChange={(v) =>
        clips.forEach((c) => setAnimatable(c, prop, v / k, () => patch(c.id, (x) => ({ ...(x as Visual), transform: { ...(x as Visual).transform, [prop]: v / k } }) as Clip, `Alterar ${label.toLowerCase()}`, `tf:${prop}:${c.id}`)))
      }
      onCommit={() => useEditor.getState().sealDrag()}
    />
  );

  return (
    <Section title="Transformação">
      {num('x', 'Posição X', -150, 150, 1, '%', 100)}
      {num('y', 'Posição Y', -150, 150, 1, '%', 100)}
      {num('scale', 'Escala', 1, 500, 1, '%', 100)}
      {num('rotation', 'Rotação', -360, 360, 1, '°', 1)}
      {num('opacity', 'Opacidade', 0, 100, 1, '%', 100)}
      <div className="mt-1 grid grid-cols-2 gap-x-3">
        <Check label="Espelhar horizontal" checked={t.flipH} onChange={(v) => all((c) => ({ ...c, transform: { ...c.transform, flipH: v } }), 'Espelhar', 'flipH')} />
        <Check label="Espelhar vertical" checked={t.flipV} onChange={(v) => all((c) => ({ ...c, transform: { ...c.transform, flipV: v } }), 'Espelhar', 'flipV')} />
      </div>
      {clip.type === 'media' && (
        <details className="mt-2">
          <summary className="disclosure-summary">Recorte</summary>
          <div className="mt-2">
            {(['l', 't', 'r', 'b'] as const).map((side) => (
              <NumberField
                key={side}
                label={{ l: 'Esquerda', t: 'Topo', r: 'Direita', b: 'Base' }[side]}
                value={t.crop[side] * 100}
                min={0}
                max={95}
                step={1}
                unit="%"
                onChange={(v) => all((c) => ({ ...c, transform: { ...c.transform, crop: { ...c.transform.crop, [side]: v / 100 } } }), 'Recortar', `crop:${side}`)}
                onCommit={() => useEditor.getState().sealDrag()}
              />
            ))}
          </div>
        </details>
      )}
    </Section>
  );
}
