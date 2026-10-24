import { api, ApiError } from '../api/client';
import type { ProjectDoc } from '../api/types';
import { drafts } from '../lib/idb';
import { useAuth } from './auth';
import { useEditor } from './editor';
import { toast } from './toasts';

let saving = false;

/** Envia o documento atual ao servidor com controle otimista de revisão. */
export async function saveNow(opts: { overwrite?: boolean } = {}): Promise<void> {
  const st = useEditor.getState();
  if (!st.projectId || saving) return;
  if (st.saveState === 'conflict' && !opts.overwrite) return;
  saving = true;
  st.setSaveState('saving');
  const snapshot = st.project;
  const id = st.projectId;
  try {
    let base = st.serverRevision;
    if (opts.overwrite) base = (await api.get<{ project: ProjectDoc }>(`/api/projects/${id}`)).project.revision;
    const r = await api.put<{ revision: number }>(`/api/projects/${id}`, { data: snapshot, baseRevision: base });
    const now = useEditor.getState();
    now.setServerRevision(r.revision);
    if (now.project === snapshot) {
      now.markSaved(r.revision);
      void drafts.remove(id);
    } else now.setSaveState('dirty'); // mudou durante o envio: será salvo de novo
  } catch (e) {
    const s = useEditor.getState();
    if (e instanceof ApiError && e.status === 409 && e.code === 'revision_conflict') s.setSaveState('conflict');
    else if (e instanceof ApiError && e.status === 0) s.setSaveState('offline');
    else {
      s.setSaveState('error');
      toast.error(e instanceof Error ? `Falha ao salvar: ${e.message}` : 'Falha ao salvar');
    }
  } finally {
    saving = false;
  }
}

/** Descarta as edições locais e carrega a versão atual do servidor. */
export async function reloadFromServer(): Promise<void> {
  const id = useEditor.getState().projectId;
  if (!id) return;
  const { project } = await api.get<{ project: ProjectDoc }>(`/api/projects/${id}`);
  useEditor.getState().replaceProject(project.data, project.revision);
  await drafts.remove(id);
}

/**
 * Observa o store: salva com debounce quando há alterações, mantém um rascunho local no IndexedDB e
 * tenta de novo quando está offline. Devolve a função de limpeza.
 */
export function startAutosave(): () => void {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    const st = useEditor.getState();
    const delay = (useAuth.getState().user?.settings.autosaveSeconds ?? 3) * 1000;
    if (st.saveState === 'dirty') {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void saveNow(), delay);
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => {
        const s = useEditor.getState();
        if (s.projectId && s.saveState !== 'saved') void drafts.save({ projectId: s.projectId, baseRevision: s.serverRevision, savedAt: Date.now(), project: s.project });
      }, 500);
    }
    if (st.saveState === 'offline') {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        const s = useEditor.getState();
        if (s.saveState === 'offline') {
          s.setSaveState('dirty');
          void saveNow();
        }
      }, 5000);
    }
  };

  const unsub = useEditor.subscribe((s, prev) => {
    if (s.saveState !== prev.saveState || s.project !== prev.project) schedule();
  });
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    const s = useEditor.getState();
    if (s.saveState === 'dirty' || s.saveState === 'saving' || s.saveState === 'offline') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  const onOnline = () => {
    if (useEditor.getState().saveState === 'offline') {
      useEditor.getState().setSaveState('dirty');
      void saveNow();
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('online', onOnline);
  return () => {
    unsub();
    clearTimeout(saveTimer);
    clearTimeout(draftTimer);
    clearTimeout(retryTimer);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('online', onOnline);
  };
}

/** Se há rascunho local mais novo que o servidor (queda/fechamento antes de salvar), restaura-o. */
export async function recoverDraft(doc: ProjectDoc): Promise<boolean> {
  const d = await drafts.get(doc.id);
  if (!d) return false;
  if (d.baseRevision !== doc.revision) {
    await drafts.remove(doc.id);
    return false;
  }
  if (JSON.stringify(d.project) === JSON.stringify(doc.data)) {
    await drafts.remove(doc.id);
    return false;
  }
  const st = useEditor.getState();
  st.commitProject('Rascunho local recuperado', d.project);
  toast.info('Recuperamos alterações não salvas deste projeto.');
  return true;
}
