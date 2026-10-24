import { BUILTIN_LUTS, BUILTIN_PREFIX, EFFECTS, TRANSITION_TYPES, getEffectDef, type Clip, type MediaClip, type TransitionType } from '@editor/core';
import { Check, NumberField, Section, Select } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { KeyframeButton, setAnimatable, valueAt } from './shared';

const TRANSITION_LABEL: Record<TransitionType, string> = {
  fade: 'Dissolver',
  'slide-left': 'Deslizar ←',
  'slide-right': 'Deslizar →',
  'slide-up': 'Deslizar ↑',
  'slide-down': 'Deslizar ↓',
  'wipe-left': 'Cortina ←',
  'wipe-right': 'Cortina →',
};

export function TimingSection({ clip }: { clip: Clip }) {
  const patch = useEditor((s) => s.patchClip);
  const trim = useEditor((s) => s.trim);
  const move = useEditor((s) => s.moveSelection);
  return (
    <Section title="Tempo">
      <NumberField label="Início" value={clip.start} min={0} step={0.01} unit="s" slider={false} onChange={(v) => move([clip.id], v - clip.start, clip.id)} onCommit={() => useEditor.getState().sealDrag()} />
      <NumberField
        label="Duração"
        value={clip.duration}
        min={0.04}
        step={0.01}
        unit="s"
        slider={false}
        onChange={(v) => (clip.type === 'media' ? trim(clip.id, 'end', clip.start + v) : patch(clip.id, (c) => ({ ...c, duration: v }), 'Alterar duração'))}
        onCommit={() => useEditor.getState().sealDrag()}
      />
    </Section>
  );
}

export function SpeedSection({ clip, kind }: { clip: MediaClip; kind: string }) {
  const setSpeed = useEditor((s) => s.setSpeed);
  const toggleReverse = useEditor((s) => s.toggleReverse);
  const freeze = useEditor((s) => s.freeze);
  if (kind === 'image') return null;
  return (
    <Section title="Velocidade">
      <NumberField label="Velocidade" value={clip.speed} min={0.1} max={8} step={0.05} unit="×" onChange={(v) => setSpeed(clip.id, v)} onCommit={() => useEditor.getState().sealDrag()} />
      <div className="mb-2 flex flex-wrap gap-1">
        {[0.25, 0.5, 1, 2, 4].map((v) => (
          <button key={v} type="button" className={`btn !h-6 px-2 text-2xs ${clip.speed === v ? 'border-accent text-accent' : ''}`} onClick={() => setSpeed(clip.id, v)}>
            {v}×
          </button>
        ))}
      </div>
      {kind === 'video' && (
        <>
          <Check label="Reproduzir em reverso" checked={clip.reverse} onChange={() => toggleReverse(clip.id)} />
          <button type="button" className="btn w-full" onClick={() => freeze(clip.id)} disabled={clip.freeze}>
            <Icon name="snowflake" size={13} /> Congelar quadro no cursor
          </button>
          {clip.reverse && <p className="mt-1 text-2xs text-mute">O preview em reverso avança por quadros e sem som; a exportação toca normalmente.</p>}
        </>
      )}
    </Section>
  );
}

export function AudioSection({ clip, hasAudio }: { clip: MediaClip; hasAudio: boolean }) {
  const patch = useEditor((s) => s.patchClip);
  const playhead = useEditor((s) => s.playhead);
  const a = clip.audio;
  if (!hasAudio) return null;
  const set = (part: Partial<MediaClip['audio']>, label: string, key?: string) => patch(clip.id, (c) => ({ ...(c as MediaClip), audio: { ...(c as MediaClip).audio, ...part } }), label, key ? `${key}:${clip.id}` : undefined);
  return (
    <Section title="Áudio">
      <NumberField
        label="Volume"
        value={valueAt(clip, 'volume', playhead) * 100}
        min={0}
        max={400}
        step={1}
        unit="%"
        right={<KeyframeButton clip={clip} prop="volume" />}
        onChange={(v) => setAnimatable(clip, 'volume', v / 100, () => set({ volume: v / 100 }, 'Alterar volume', 'vol'))}
        onCommit={() => useEditor.getState().sealDrag()}
      />
      <Check label="Silenciar clipe" checked={a.muted} onChange={(v) => set({ muted: v }, 'Silenciar')} />
      <NumberField label="Fade in" value={a.fadeIn} min={0} max={Math.max(0.1, clip.duration)} step={0.1} unit="s" onChange={(v) => set({ fadeIn: v }, 'Fade in', 'fi')} onCommit={() => useEditor.getState().sealDrag()} />
      <NumberField label="Fade out" value={a.fadeOut} min={0} max={Math.max(0.1, clip.duration)} step={0.1} unit="s" onChange={(v) => set({ fadeOut: v }, 'Fade out', 'fo')} onCommit={() => useEditor.getState().sealDrag()} />
      <NumberField label="Balanço (E ↔ D)" value={a.pan} min={-1} max={1} step={0.05} onChange={(v) => set({ pan: v }, 'Balanço', 'pan')} onCommit={() => useEditor.getState().sealDrag()} />
      <details className="mt-1">
        <summary className="cursor-pointer text-2xs font-semibold uppercase tracking-wide text-mute">Equalizador</summary>
        <div className="mt-2">
          {(['bass', 'mid', 'treble'] as const).map((b) => (
            <NumberField key={b} label={{ bass: 'Graves', mid: 'Médios', treble: 'Agudos' }[b]} value={a.eq[b]} min={-24} max={24} step={0.5} unit="dB" onChange={(v) => set({ eq: { ...a.eq, [b]: v } }, 'Equalizar', `eq${b}`)} onCommit={() => useEditor.getState().sealDrag()} />
          ))}
        </div>
      </details>
      <div className="mt-2">
        <Check label="Normalizar volume (−16 LUFS)" checked={a.normalize} onChange={(v) => set({ normalize: v }, 'Normalizar áudio')} />
        <Check label="Reduzir ruído" checked={a.denoise} onChange={(v) => set({ denoise: v }, 'Reduzir ruído')} />
        <p className="text-2xs text-mute">Normalização e redução de ruído são aplicadas na exportação (não no preview).</p>
      </div>
    </Section>
  );
}

export function StabilizeSection({ clip, kind }: { clip: MediaClip; kind: string }) {
  const setStabilize = useEditor((s) => s.setStabilize);
  if (kind !== 'video' || clip.freeze) return null;
  return (
    <Section title="Estabilização" defaultOpen={clip.stabilize > 0}>
      <NumberField label="Suavização (0 = desligada)" value={clip.stabilize} min={0} max={30} step={1} unit="qd" onChange={(v) => setStabilize(clip.id, Math.round(v))} onCommit={() => useEditor.getState().sealDrag()} />
      <p className="text-2xs text-mute">Reduz a tremedeira de câmera na mão (análise em duas passadas, com leve ampliação para esconder as bordas). Aplicada na exportação; o preview mostra o vídeo original.</p>
    </Section>
  );
}

export function EffectsSection({ clip }: { clip: MediaClip }) {
  const luts = useEditor((s) => s.project.luts);
  const lutName = (ref?: string) => (ref?.startsWith(BUILTIN_PREFIX) ? BUILTIN_LUTS.find((l) => l.id === ref.slice(BUILTIN_PREFIX.length))?.label : ref ? luts[ref]?.name : undefined) ?? 'LUT ausente';
  const add = useEditor((s) => s.addEffect);
  const update = useEditor((s) => s.updateEffect);
  const toggle = useEditor((s) => s.toggleEffect);
  const remove = useEditor((s) => s.removeEffect);
  return (
    <Section
      title={`Efeitos${clip.effects.length ? ` (${clip.effects.length})` : ''}`}
      action={
        <select
          className="mr-1 h-6 rounded border border-line bg-bg px-1 text-2xs text-mute"
          aria-label="Adicionar efeito"
          value=""
          onChange={(e) => e.target.value && add(clip.id, e.target.value)}
        >
          <option value="">+ Adicionar</option>
          {EFFECTS.filter((e) => e.type !== 'lut').map((e) => (
            <option key={e.type} value={e.type}>
              {e.label}
            </option>
          ))}
        </select>
      }
    >
      {clip.effects.length === 0 && <p className="text-2xs text-mute">Nenhum efeito. Use a aba Efeitos ou o seletor acima.</p>}
      {clip.effects.map((fx) => {
        const def = getEffectDef(fx.type);
        if (!def) return null;
        return (
          <div key={fx.id} className="mb-3 rounded-lg border border-line bg-panel2 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <Icon name="wand" size={12} className={fx.enabled ? 'text-accent' : 'text-mute'} /> {fx.type === 'lut' ? `LUT: ${lutName(fx.ref)}` : def.label}
              </span>
              <span className="flex gap-0.5">
                <button type="button" className="btn-icon !h-6 !w-6" aria-label={fx.enabled ? `Desativar ${def.label}` : `Ativar ${def.label}`} aria-pressed={!fx.enabled} onClick={() => toggle(clip.id, fx.id)}>
                  <Icon name={fx.enabled ? 'eye' : 'eyeOff'} size={13} />
                </button>
                <button type="button" className="btn-icon !h-6 !w-6" aria-label={`Remover ${def.label}`} onClick={() => remove(clip.id, fx.id)}>
                  <Icon name="x" size={13} />
                </button>
              </span>
            </div>
            {def.params.map((p) => (
              <NumberField key={p.key} label={p.label} value={fx.params[p.key] ?? p.default} min={p.min} max={p.max} step={p.step} onChange={(v) => update(clip.id, fx.id, { [p.key]: v })} onCommit={() => useEditor.getState().sealDrag()} />
            ))}
          </div>
        );
      })}
    </Section>
  );
}

export function MaskSection({ clip }: { clip: MediaClip }) {
  const patch = useEditor((s) => s.patchClip);
  const m = clip.mask;
  const set = (mask: MediaClip['mask'], label = 'Máscara', key?: string) => patch(clip.id, (c) => ({ ...(c as MediaClip), mask }), label, key ? `${key}:${clip.id}` : undefined);
  return (
    <Section title="Máscara" defaultOpen={false}>
      <Select
        label="Forma"
        value={m?.shape ?? 'none'}
        options={[
          { value: 'none', label: 'Sem máscara' },
          { value: 'rect', label: 'Retângulo' },
          { value: 'ellipse', label: 'Elipse' },
        ]}
        onChange={(v) => set(v === 'none' ? undefined : { shape: v, cx: m?.cx ?? 0.5, cy: m?.cy ?? 0.5, w: m?.w ?? 0.8, h: m?.h ?? 0.8, invert: m?.invert ?? false })}
      />
      {m && (
        <>
          <NumberField label="Centro X" value={m.cx * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ ...m, cx: v / 100 }, 'Máscara', 'mcx')} onCommit={() => useEditor.getState().sealDrag()} />
          <NumberField label="Centro Y" value={m.cy * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ ...m, cy: v / 100 }, 'Máscara', 'mcy')} onCommit={() => useEditor.getState().sealDrag()} />
          <NumberField label="Largura" value={m.w * 100} min={1} max={100} step={1} unit="%" onChange={(v) => set({ ...m, w: v / 100 }, 'Máscara', 'mw')} onCommit={() => useEditor.getState().sealDrag()} />
          <NumberField label="Altura" value={m.h * 100} min={1} max={100} step={1} unit="%" onChange={(v) => set({ ...m, h: v / 100 }, 'Máscara', 'mh')} onCommit={() => useEditor.getState().sealDrag()} />
          <Check label="Inverter máscara" checked={m.invert} onChange={(v) => set({ ...m, invert: v })} />
          <p className="text-2xs text-mute">A máscara é aplicada no preview e na exportação com a mesma geometria.</p>
        </>
      )}
    </Section>
  );
}

export function TransitionSection({ clip }: { clip: MediaClip }) {
  const set = useEditor((s) => s.setTransition);
  const remove = useEditor((s) => s.removeTransition);
  const tr = clip.transitionIn;
  return (
    <Section title="Transição de entrada" defaultOpen={!!tr} forceOpen={!!tr}>
      <Select
        label="Tipo"
        value={tr?.type ?? 'none'}
        options={[{ value: 'none' as TransitionType | 'none', label: 'Nenhuma' }, ...TRANSITION_TYPES.map((t) => ({ value: t as TransitionType | 'none', label: TRANSITION_LABEL[t] }))]}
        onChange={(v) => (v === 'none' ? remove(clip.id) : set(clip.id, v, tr?.duration ?? 0.6))}
      />
      {tr && <NumberField label="Duração" value={tr.duration} min={0.2} max={3} step={0.1} unit="s" onChange={(v) => set(clip.id, tr.type, v)} onCommit={() => useEditor.getState().sealDrag()} />}
      {!tr && <p className="text-2xs text-mute">Precisa de um clipe encostado antes deste na mesma faixa.</p>}
    </Section>
  );
}
