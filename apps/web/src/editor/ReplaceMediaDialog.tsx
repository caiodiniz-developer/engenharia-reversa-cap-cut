import { useEffect, useMemo, useState } from 'react';
import { usedMediaIds } from '@editor/core';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { formatDuration } from '../lib/format';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';

/** Troca um arquivo por outro em todos os clipes que o usam, mantendo posição, efeitos e ajustes. */
export function ReplaceMediaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const library = useEditor((s) => s.media);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const used = useMemo(() => [...usedMediaIds(project)].filter((id) => project.media[id]), [project]);
  const source = from ? project.media[from] : undefined;
  const candidates = useMemo(
    () => Object.values(library).filter((m) => m.id !== from && m.status === 'ready' && source && m.kind === source.kind),
    [library, from, source],
  );

  useEffect(() => {
    if (!open) return;
    setFrom(used[0] ?? '');
    setTo('');
  }, [open, used]);

  useEffect(() => {
    if (to && !candidates.some((m) => m.id === to)) setTo('');
  }, [candidates, to]);

  function run() {
    if (!from || !to) return;
    const n = useEditor.getState().replaceMediaWith(from, to);
    if (n > 0) {
      toast.success(n === 1 ? '1 clipe agora usa a nova mídia' : n + ' clipes agora usam a nova mídia');
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Substituir mídia" width={460}>
      {used.length === 0 ? (
        <p className="py-8 text-center text-xs text-mute" data-testid="replace-media-empty">
          Nenhum clipe usa mídia ainda. Adicione algo à timeline para poder trocar.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <p className="mb-3 text-2xs leading-relaxed text-mute">
            Todos os clipes que usam o arquivo escolhido passam a usar o novo, sem mexer em posição, efeitos ou ajustes. Os dois precisam ser do mesmo tipo e o novo precisa ter pelo menos a duração do trecho usado.
          </p>
          <label className="label" htmlFor="rm-from">
            Trocar
          </label>
          <select id="rm-from" className="field mb-3" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="replace-media-from">
            {used.map((id) => (
              <option key={id} value={id}>
                {project.media[id]!.name}
              </option>
            ))}
          </select>
          <label className="label" htmlFor="rm-to">
            Por
          </label>
          <select id="rm-to" className="field mb-1" value={to} onChange={(e) => setTo(e.target.value)} data-testid="replace-media-to">
            <option value="">Escolha um arquivo da biblioteca…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.kind !== 'image' ? '(' + formatDuration(m.duration) + ')' : ''}
              </option>
            ))}
          </select>
          {source && candidates.length === 0 && <p className="mb-3 text-2xs text-mute">Não há outro arquivo do mesmo tipo na biblioteca. Importe um na aba Mídia.</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!from || !to} data-testid="replace-media-run">
              <Icon name="check" size={14} /> Substituir
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
