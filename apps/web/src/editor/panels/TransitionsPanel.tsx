import { motion } from 'framer-motion';
import { useState } from 'react';
import { findClip, TRANSITION_TYPES, type TransitionType } from '@editor/core';
import { NumberField } from '../../components/controls';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

const LABELS: Record<TransitionType, string> = {
  fade: 'Dissolver',
  'slide-left': 'Deslizar ←',
  'slide-right': 'Deslizar →',
  'slide-up': 'Deslizar ↑',
  'slide-down': 'Deslizar ↓',
  'wipe-left': 'Cortina ←',
  'wipe-right': 'Cortina →',
};

/** Miniatura animada que mostra o movimento da transição (azul entra sobre laranja). */
function Demo({ type }: { type: TransitionType }) {
  const from = { fade: { opacity: 0 }, 'slide-left': { x: '100%' }, 'slide-right': { x: '-100%' }, 'slide-up': { y: '100%' }, 'slide-down': { y: '-100%' }, 'wipe-left': { clipPath: 'inset(0 0 0 100%)' }, 'wipe-right': { clipPath: 'inset(0 100% 0 0)' } }[type];
  const to = { opacity: 1, x: 0, y: 0, clipPath: 'inset(0 0 0 0)' };
  return (
    <div className="relative h-10 w-full overflow-hidden rounded bg-amber-500/80" aria-hidden="true">
      <motion.div className="absolute inset-0 bg-sky-500" initial={from} animate={to} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.5, repeatType: 'loop', ease: 'easeInOut' }} />
    </div>
  );
}

export function TransitionsPanel() {
  const [duration, setDuration] = useState(0.6);
  const setTransition = useEditor((s) => s.setTransition);
  const removeTransition = useEditor((s) => s.removeTransition);

  const apply = (type: TransitionType) => {
    const { project, selection } = useEditor.getState();
    const id = selection.find((i) => findClip(project, i)?.clip.type === 'media' && findClip(project, i)?.track.kind === 'video');
    if (!id) return toast.info('Selecione o clipe que deve entrar com a transição (precisa ter um clipe antes dele)');
    setTransition(id, type, duration);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <p className="mb-2 text-2xs text-mute">A transição acontece na entrada do clipe selecionado, sobrepondo-o ao clipe anterior.</p>
        <NumberField label="Duração" value={duration} onChange={setDuration} min={0.2} max={3} step={0.1} unit="s" />
        <button
          type="button"
          className="btn w-full"
          onClick={() => {
            const { project, selection } = useEditor.getState();
            const id = selection.find((i) => (findClip(project, i)?.clip as { transitionIn?: unknown } | undefined)?.transitionIn);
            if (id) removeTransition(id);
            else toast.info('O clipe selecionado não tem transição');
          }}
        >
          Remover transição do clipe selecionado
        </button>
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-auto p-3">
        {TRANSITION_TYPES.map((t) => (
          <li key={t}>
            <button type="button" className="w-full rounded-lg border border-line bg-panel2 p-2 text-left transition-colors hover:border-accent/60" onClick={() => apply(t)}>
              <Demo type={t} />
              <span className="mt-1.5 block text-xs font-medium">{LABELS[t]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
