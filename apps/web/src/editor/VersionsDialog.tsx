import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@editor/core';
import { api, ApiError } from '../api/client';
import { Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { formatRelative } from '../lib/format';
import { useEditor } from '../store/editor';
import { saveNow } from '../store/persist';
import { toast } from '../store/toasts';

interface Version {
  id: string;
  revision: number;
  label: string;
  createdAt: string;
}

/** Versões salvas do projeto: criar um marco nomeado ou voltar a uma versão anterior (reversível). */
export function VersionsDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      await saveNow();
      setVersions((await api.get<{ versions: Version[] }>(`/api/projects/${projectId}/versions`)).versions);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível carregar as versões');
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      setConfirming(null);
      void load();
    }
  }, [open, load]);

  async function create() {
    setBusy(true);
    try {
      await saveNow();
      await api.post(`/api/projects/${projectId}/versions`, { label: label.trim() || undefined });
      setLabel('');
      toast.success('Versão salva');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível salvar a versão');
    } finally {
      setBusy(false);
    }
  }

  async function restore(revision: number) {
    setBusy(true);
    try {
      await saveNow();
      const r = await api.post<{ revision: number; data: Project }>(`/api/projects/${projectId}/versions/${revision}/restore`);
      useEditor.getState().replaceProject(r.data, r.revision);
      toast.success(`Versão ${revision} restaurada. O estado anterior ficou guardado na lista.`);
      setConfirming(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível restaurar a versão');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Versões do projeto" width={480}>
      <p className="mb-3 text-2xs leading-relaxed text-mute">O editor guarda versões automaticamente ao salvar. Crie um marco com nome antes de uma mudança grande; restaurar nunca perde o estado atual, que vira uma nova versão.</p>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input className="field flex-1" placeholder="Nome da versão (opcional)" aria-label="Nome da versão" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={busy} data-testid="save-version">
          <Icon name="cloud" size={14} /> Salvar versão
        </button>
      </form>

      {versions === null ? (
        <p className="py-6 text-center text-xs text-mute">Carregando…</p>
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-xs text-mute">Nenhuma versão ainda.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-auto" data-testid="version-list">
          {versions.map((v) => (
            <li key={v.id} className="card flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" title={v.label}>
                  {v.label}
                </p>
                <p className="text-2xs text-mute">
                  Revisão {v.revision} · {formatRelative(v.createdAt)}
                </p>
              </div>
              {confirming === v.revision ? (
                <>
                  <button type="button" className="btn !h-7 px-2 text-2xs" onClick={() => setConfirming(null)} disabled={busy}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary !h-7 px-2 text-2xs" onClick={() => void restore(v.revision)} disabled={busy} aria-label={`Confirmar restauração da revisão ${v.revision}`}>
                    Confirmar
                  </button>
                </>
              ) : (
                <button type="button" className="btn !h-7 px-2 text-2xs" onClick={() => setConfirming(v.revision)} disabled={busy} aria-label={`Restaurar revisão ${v.revision}`}>
                  Restaurar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
