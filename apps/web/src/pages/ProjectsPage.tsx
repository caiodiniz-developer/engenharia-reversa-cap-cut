import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ProjectSummary } from '../api/types';
import { Empty, Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { ASPECTS, formatRelative } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/toasts';

export function ProjectsPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]['id']>('16:9');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProjectSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects((await api.get<{ projects: ProjectSummary[] }>('/api/projects')).projects);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar projetos');
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    try {
      const a = ASPECTS.find((x) => x.id === aspect)!;
      const r = await api.post<{ project: { id: string } }>('/api/projects', { name: name.trim() || 'Projeto sem título', settings: { width: a.width, height: a.height } });
      navigate(`/p/${r.project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao criar o projeto');
      setBusy(false);
    }
  }

  async function remove(p: ProjectSummary) {
    try {
      await api.del(`/api/projects/${p.id}`);
      setProjects((list) => list?.filter((x) => x.id !== p.id) ?? null);
      toast.success(`"${p.name}" excluído`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir');
    }
    setConfirmDelete(null);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-bg">
            <Icon name="play" size={13} />
          </span>
          <span className="text-sm font-semibold">Editor de Vídeo</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-mute">
          <span>{user?.name}</span>
          <button type="button" className="btn" onClick={logout}>
            <Icon name="logout" size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-xl font-semibold">Seus projetos</h1>
              <p className="mt-1 text-xs text-mute">Tudo é salvo automaticamente no servidor.</p>
            </div>
            <button type="button" className="btn btn-primary h-9" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} /> Novo projeto
            </button>
          </div>

          {projects === null ? (
            <p className="text-xs text-mute">Carregando…</p>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line">
              <Empty icon="film" title="Nenhum projeto ainda" hint="Crie um projeto para importar vídeos e começar a editar." />
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p, i) => (
                <motion.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="group relative overflow-hidden rounded-xl border border-line bg-panel transition-colors hover:border-mute/40">
                  <button type="button" className="block w-full text-left" onClick={() => navigate(`/p/${p.id}`)} aria-label={`Abrir ${p.name}`}>
                    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-panel2 to-bg text-mute">
                      <Icon name="film" size={28} />
                    </div>
                    <div className="p-3">
                      <h2 className="truncate text-sm font-medium">{p.name}</h2>
                      <p className="mt-0.5 text-2xs text-mute">Editado {formatRelative(p.updatedAt)}</p>
                    </div>
                  </button>
                  <button type="button" className="btn-icon absolute right-2 top-2 bg-bg/70 opacity-0 backdrop-blur transition-opacity focus:opacity-100 group-hover:opacity-100" aria-label={`Excluir ${p.name}`} onClick={() => setConfirmDelete(p)}>
                    <Icon name="trash" size={14} />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Modal open={creating} onClose={() => !busy && setCreating(false)} title="Novo projeto" width={420}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label className="label" htmlFor="pname">
            Nome
          </label>
          <input id="pname" className="field mb-4" placeholder="Projeto sem título" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <span className="label">Formato</span>
          <div className="mb-5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formato do vídeo">
            {ASPECTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={aspect === a.id} onClick={() => setAspect(a.id)} className={`rounded-lg border p-2 text-center transition-colors ${aspect === a.id ? 'border-accent bg-accent/10 text-ink' : 'border-line text-mute hover:border-mute/50'}`}>
                <span className="mx-auto mb-1.5 block rounded-sm border border-current" style={{ width: 28 * Math.min(1, a.width / a.height), height: 28 * Math.min(1, a.height / a.width) }} />
                <span className="text-2xs font-medium">{a.id}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setCreating(false)} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Criando…' : 'Criar e abrir'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir projeto" width={400}>
        <p className="mb-4 text-xs text-mute">
          "{confirmDelete?.name}" e todas as mídias enviadas para ele serão removidos do servidor. Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </button>
          <button type="button" className="btn border-danger bg-danger text-white hover:bg-danger/90" onClick={() => confirmDelete && void remove(confirmDelete)}>
            Excluir definitivamente
          </button>
        </div>
      </Modal>
    </div>
  );
}
