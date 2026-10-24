import { evaluateKeyframes, resolveTransform, type AnimatableProp, type Clip, type MediaClip } from '@editor/core';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';

/** Valor efetivo da propriedade no instante atual (considera keyframes). */
export function valueAt(clip: Clip, prop: AnimatableProp, playhead: number): number {
  const local = playhead - clip.start;
  if (prop === 'volume') return clip.type === 'media' ? evaluateKeyframes(clip.keyframes.volume, local, (clip as MediaClip).audio.volume) : 1;
  return resolveTransform(clip, local)[prop];
}

/** Botão de keyframe (losango): adiciona/remove um keyframe da propriedade na cabeça de reprodução. */
export function KeyframeButton({ clip, prop }: { clip: Clip; prop: AnimatableProp }) {
  const playhead = useEditor((s) => s.playhead);
  const fps = useEditor((s) => s.project.settings.fps);
  const kfs = clip.keyframes[prop] ?? [];
  const local = playhead - clip.start;
  const here = kfs.some((k) => Math.abs(k.time - local) < 0.5 / fps);
  const inside = local >= -1e-6 && local <= clip.duration + 1e-6;
  const s = useEditor.getState();
  return (
    <button
      type="button"
      className={`btn-icon !h-5 !w-5 ${here ? '!text-accent' : kfs.length ? 'text-accent/60' : ''}`}
      aria-label={here ? 'Remover keyframe aqui' : 'Adicionar keyframe aqui'}
      aria-pressed={here}
      title={kfs.length ? `${kfs.length} keyframe(s). ${here ? 'Clique para remover.' : 'Clique para adicionar neste instante.'}` : 'Animar esta propriedade (adiciona um keyframe no instante atual)'}
      disabled={!inside}
      onClick={() => (here ? s.removeKeyframe(clip.id, prop) : s.setKeyframe(clip.id, prop, valueAt(clip, prop, playhead)))}
    >
      <Icon name="diamond" size={11} style={{ fill: here ? 'currentColor' : 'none' }} />
    </button>
  );
}

/** Aplica a mudança de uma propriedade animável: cria keyframe se já estiver animada, senão altera o valor fixo. */
export function setAnimatable(clip: Clip, prop: AnimatableProp, value: number, patchStatic: () => void): void {
  const s = useEditor.getState();
  if ((clip.keyframes[prop]?.length ?? 0) > 0) s.setKeyframe(clip.id, prop, value);
  else patchStatic();
}
