import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@editor/core';
import { api, ApiError } from '../api/client';
import type { ProjectSummary } from '../api/types';
import { Empty, Modal } from '../components/controls';
import { Icon } from '../components/Icon';
import { ASPECTS, aspectLabel, formatDuration, formatRelative } from '../lib/format';
import { getTemplate, TEMPLATES } from '../lib/templates';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';
import { toast } from '../store/toasts';

type Sort = 'recent' | 'name' | 'duration';

function ProjectCard({ p, index, onOpen, onRename, onDuplicate, onDelete }: { p: ProjectSummary; index: number; onOpen: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  const m = p.meta;
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className="group relative">
      <div className="card card-hover overflow-hidden">
        <button type="button" className="block w-full text-left" onClick={onOpen} aria-label={`Abrir ${p.name}`}>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-panel-3 to-bg text-mute">
            {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" /> : <Icon name="film" size={30} />}
            {m && m.duration > 0 && <span className="tnum absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-2xs text-white">{formatDuration(m.duration)}</span>}
            {m && <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-2xs font-medium text-white backdrop-blur">{aspectLabel(m.width, m.height)}</span>}
          </div>
          <div className="px-3.5 pb-3 pt-2.5">
            <h2 className="truncate text-sm font-semibold">{p.name}</h2>
            <p className="mt-0.5 text-2xs text-mute">
              {m ? `${m.clips} ${m.clips === 1 ? 'clipe' : 'clipes'} · ` : ''}Editado {formatRelative(p.updatedAt)}
            </p>
          </div>
        </button>
      </div>
      <div ref={ref} className="absolute right-2 top-2">
        <button type="button" className="btn-icon bg-black/50 text-white opacity-0 backdrop-blur transition-opacity hover:!bg-black/70 hover:!text-white focus:opacity-100 group-hover:opacity-100" aria-label={`Mais ações para ${p.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <Icon name="more" size={16} />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-pop">
            {[
              { label: 'Abrir', icon: 'play' as const, run: onOpen },
              { label: 'Renomear', icon: 'pencil' as const, run: onRename },
              { label: 'Duplicar', icon: 'copyPlus' as const, run: onDuplicate },
              { label: 'Excluir', icon: 'trash' as const, run: onDelete, danger: true },
            ].map((it) => (
              <button
                key={it.label}
                role="menuitem"
                type="button"
                aria-label={`${it.label} ${p.name}`}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-panel-3 ${it.danger ? 'text-danger' : ''}`}
                onClick={() => {
                  setMenu(false);
                  it.run();
                }}
              >
                <Icon name={it.icon} size={14} /> {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function ProjectsPage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]['id']>('16:9');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProjectSummary | null>(null);
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    if (sort === 'duration') return [...list].sort((a, b) => (b.meta?.duration ?? 0) - (a.meta?.duration ?? 0));
    return list;
  }, [projects, query, sort]);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    setAspect(getTemplate(id).aspect);
  }

  async function create() {
    setBusy(true);
    try {
      const a = ASPECTS.find((x) => x.id === aspect)!;
      const tpl = getTemplate(templateId);
      const r = await api.post<{ project: { id: string; revision: number; data: Project } }>('/api/projects', { name: name.trim() || (tpl.id === 'blank' ? 'Projeto sem título' : tpl.name), settings: { width: a.width, height: a.height } });
      if (tpl.id !== 'blank') {
        const doc = tpl.build(r.project.data);
        await api.put(`/api/projects/${r.project.id}`, { data: doc, baseRevision: r.project.revision });
      }
      navigate(`/p/${r.project.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Falha ao criar o projeto');
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

  async function duplicate(p: ProjectSummary) {
    try {
      toast.info('Duplicando… mídias grandes podem levar alguns segundos');
      await api.post(`/api/projects/${p.id}/duplicate`);
      await load();
      toast.success(`Cópia de "${p.name}" criada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao duplicar');
    }
  }

  async function rename() {
    if (!renaming || !renameValue.trim()) return;
    try {
      const r = await api.patch<{ project: { name: string } }>(`/api/projects/${renaming.id}`, { name: renameValue.trim() });
      setProjects((list) => list?.map((x) => (x.id === renaming.id ? { ...x, name: r.project.name } : x)) ?? null);
      setRenaming(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao renomear');
    }
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-panel p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Icon name="play" size={16} />
          </span>
          <span className="text-sm font-semibold leading-tight">Editor de Vídeo</span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navegação">
          <span className="flex items-center gap-2.5 rounded-lg bg-accent/12 px-3 py-2 text-xs font-semibold text-accent" aria-current="page">
            <Icon name="folder" size={15} /> Projetos
          </span>
          <button type="button" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-mute hover:bg-panel-3 hover:text-ink" onClick={() => setCreating(true)}>
            <Icon name="layout" size={15} /> Modelos
          </button>
        </nav>
        <div className="mt-auto space-y-2">
          <button type="button" className="btn w-full justify-start" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} /> Tema {theme === 'dark' ? 'claro' : 'escuro'}
          </button>
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-panel-2 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{(user?.name ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{user?.name}</span>
              <span className="block truncate text-2xs text-mute">{user?.email}</span>
            </span>
            <button type="button" className="btn-icon" onClick={logout} aria-label="Sair" title="Sair">
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Seus projetos</h1>
              <p className="mt-1 text-xs text-mute">Tudo é salvo automaticamente no servidor.</p>
            </div>
            <button type="button" className="btn btn-primary h-10 px-5 text-sm shadow-sm" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} /> Novo projeto
            </button>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input className="field h-9 pl-9" placeholder="Buscar projetos" aria-label="Buscar projetos" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-xs text-mute">
              Ordenar
              <select className="field h-9 w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar projetos">
                <option value="recent">Mais recentes</option>
                <option value="name">Nome (A–Z)</option>
                <option value="duration">Duração</option>
              </select>
            </label>
          </div>

          {projects === null ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Carregando">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="card h-52 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line">
              <Empty icon="film" title="Nenhum projeto ainda" hint="Crie um projeto em branco ou comece por um modelo pronto para Reels, YouTube e mais.">
                <button type="button" className="btn btn-primary mt-2" onClick={() => setCreating(true)}>
                  <Icon name="plus" size={14} /> Criar meu primeiro projeto
                </button>
              </Empty>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-xs text-mute">Nenhum projeto corresponde a “{query}”.</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="project-grid">
              {shown.map((p, i) => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  index={i}
                  onOpen={() => navigate(`/p/${p.id}`)}
                  onRename={() => {
                    setRenaming(p);
                    setRenameValue(p.name);
                  }}
                  onDuplicate={() => void duplicate(p)}
                  onDelete={() => setConfirmDelete(p)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      <Modal open={creating} onClose={() => !busy && setCreating(false)} title="Novo projeto" width={640}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <span className="label">Modelo</span>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modelo do projeto">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={templateId === t.id} onClick={() => chooseTemplate(t.id)} className={`rounded-xl border p-3 text-left transition-colors ${templateId === t.id ? 'border-accent bg-accent/10' : 'border-line hover:border-mute/50'}`}>
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <Icon name={t.icon} size={14} className="text-accent" /> {t.name}
                </span>
                <span className="block text-2xs leading-snug text-mute">{t.description}</span>
              </button>
            ))}
          </div>

          <label className="label" htmlFor="pname">
            Nome
          </label>
          <input id="pname" className="field mb-4" placeholder="Projeto sem título" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <span className="label">Formato do vídeo</span>
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Formato do vídeo">
            {ASPECTS.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={aspect === a.id} onClick={() => setAspect(a.id)} className={`rounded-lg border p-2 text-center transition-colors ${aspect === a.id ? 'border-accent bg-accent/10 text-ink' : 'border-line text-mute hover:border-mute/50'}`}>
                <span className="mx-auto mb-1.5 block rounded-sm border border-current" style={{ width: 26 * Math.min(1, a.width / a.height), height: 26 * Math.min(1, a.height / a.width) }} />
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

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Renomear projeto" width={420}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <label className="label" htmlFor="rname">
            Novo nome
          </label>
          <input id="rname" className="field mb-4" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setRenaming(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!renameValue.trim()}>
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir projeto" width={420}>
        <p className="mb-4 text-xs leading-relaxed text-mute">
          "{confirmDelete?.name}" e todas as mídias enviadas para ele serão removidos do servidor. Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={() => confirmDelete && void remove(confirmDelete)}>
            Excluir definitivamente
          </button>
        </div>
      </Modal>
    </div>
  );
}

