import { useMemo, useState } from 'react';
import { unusedMediaIds } from '@editor/core';
import { api } from '../api/client';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { formatBytes } from '../lib/format';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';

/** Lista as mídias importadas que nenhum clipe usa e remove todas de uma vez (arquivos incluídos). */
export function CleanupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const media = useEditor((s) => s.media);
  const project = useEditor((s) => s.project);
  const [busy, setBusy] = useState(false);

  const unused = useMemo(() => unusedMediaIds(project, Object.keys(media)).map((id) => media[id]!).filter(Boolean), [project, media]);
  const total = unused.reduce((n, m) => n + m.size, 0);

  async function run() {
    setBusy(true);
    let removed = 0;
    try {
      for (const m of unused) {
        await api.del(`/api/media/${m.id}`);
        useEditor.getState().removeMediaItem(m.id);
        removed++;
      }
      toast.success(removed === 1 ? '1 mídia removida' : `${removed} mídias removidas`);
      onClose();
    } catch (e) {
      toast.error(`${removed ? removed + ' removidas, mas houve ' : 'Houve '}um erro: ${e instanceof Error ? e.message : 'falha ao remover'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Limpar mídias não usadas" width={460}>
      {unused.length === 0 ? (
        <p className="py-6 text-center text-xs text-mute" data-testid="cleanup-empty">
          Todas as mídias da biblioteca estão em uso na timeline.
        </p>
      ) : (
        <>
          <p className="mb-3 text-2xs leading-relaxed text-mute">
            {unused.length} {unused.length === 1 ? 'mídia' : 'mídias'} ({formatBytes(total)}) não {unused.length === 1 ? 'aparece' : 'aparecem'} em nenhum clipe. Remover apaga também os arquivos enviados; isso não pode ser desfeito.
          </p>
          <ul className="mb-4 max-h-56 space-y-1 overflow-auto" data-testid="cleanup-list">
            {unused.map((m) => (
              <li key={m.id} className="card flex items-center gap-2 px-3 py-1.5 text-xs">
                <Icon name={m.kind === 'audio' ? 'music' : m.kind === 'image' ? 'image' : 'film'} size={14} className="text-mute" />
                <span className="flex-1 truncate" title={m.name}>
                  {m.name}
                </span>
                <span className="text-2xs text-mute">{formatBytes(m.size)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void run()} disabled={busy} data-testid="cleanup-run">
              <Icon name="trash" size={14} /> {busy ? 'Removendo…' : `Remover ${unused.length}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
