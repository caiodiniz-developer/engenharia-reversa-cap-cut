import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { MediaItem, ProjectDoc } from '../api/types';
import { Icon, type IconName } from '../components/Icon';
import { ExportDialog } from '../editor/ExportDialog';
import { AiPanel } from '../editor/panels/AiPanel';
import { EffectsPanel } from '../editor/panels/EffectsPanel';
import { MediaPanel } from '../editor/panels/MediaPanel';
import { TextPanel } from '../editor/panels/TextPanel';
import { TransitionsPanel } from '../editor/panels/TransitionsPanel';
import { ShortcutsDialog } from '../editor/Popovers';
import { Preview } from '../editor/Preview';
import { Properties } from '../editor/props/Properties';
import { Timeline } from '../editor/timeline/Timeline';
import { TopBar } from '../editor/TopBar';
import { useShortcuts } from '../editor/useShortcuts';
import { Divider, useResizable } from '../editor/useResizable';
import { useEditor, type PanelTab } from '../store/editor';
import { bindEvents } from '../store/jobs';
import { recoverDraft, reloadFromServer, saveNow, startAutosave } from '../store/persist';
import { toast } from '../store/toasts';

const TABS: Array<{ id: PanelTab; label: string; icon: IconName }> = [
  { id: 'media', label: 'Mídia', icon: 'film' },
  { id: 'effects', label: 'Efeitos', icon: 'wand' },
  { id: 'transitions', label: 'Transições', icon: 'shuffle' },
  { id: 'text', label: 'Texto', icon: 'type' },
  { id: 'ai', label: 'IA', icon: 'sparkles' },
];

async function loadAllMedia(projectId: string): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let cursor: string | null = null;
  do {
    const r: { media: MediaItem[]; nextCursor: string | null } = await api.get(`/api/projects/${projectId}/media?limit=100${cursor ? `&cursor=${cursor}` : ''}`);
    out.push(...r.media);
    cursor = r.nextCursor;
  } while (cursor);
  return out;
}

export function EditorPage() {
  const { id = '' } = useParams();
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [exporting, setExporting] = useState(false);
  const [help, setHelp] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const saveState = useEditor((s) => s.saveState);
  const left = useResizable('left', 300, 240, 480, 'x');
  const right = useResizable('right', 320, 260, 520, 'x', true);
  const timeline = useResizable('timeline', 300, 160, 640, 'y', true);
  const openHelp = useCallback(() => setHelp(true), []);
  useShortcuts(openHelp);

  useEffect(() => {
    let alive = true;
    let stopAutosave: (() => void) | undefined;
    let stopEvents: (() => void) | undefined;
    (async () => {
      try {
        const [{ project }, media] = await Promise.all([api.get<{ project: ProjectDoc }>(`/api/projects/${id}`), loadAllMedia(id)]);
        if (!alive) return;
        useEditor.getState().load(project, media);
        await recoverDraft(project);
        stopEvents = bindEvents();
        stopAutosave = startAutosave();
        setState('ready');
      } catch (e) {
        if (!alive) return;
        setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
      }
    })();
    return () => {
      alive = false;
      stopAutosave?.();
      stopEvents?.();
      const s = useEditor.getState();
      if (s.projectId === id && (s.saveState === 'dirty' || s.saveState === 'offline')) void saveNow();
      s.setPlaying(false);
    };
  }, [id]);

  // Mídias em processamento: confirma o estado periodicamente caso o WebSocket esteja fora.
  const processing = useEditor((s) => Object.values(s.media).some((m) => m.status === 'processing'));
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      for (const m of Object.values(useEditor.getState().media)) {
        if (m.status === 'processing') void api.get<{ media: MediaItem }>(`/api/media/${m.id}`).then((r) => useEditor.getState().registerMedia([r.media])).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [processing]);

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-xs text-mute" role="status">
        Abrindo projeto…
      </div>
    );
  }
  if (state !== 'ready') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Icon name="alert" size={28} className="text-mute" />
        <p className="text-sm">{state === 'missing' ? 'Projeto não encontrado.' : 'Não foi possível abrir o projeto.'}</p>
        <Link to="/" className="btn">
          Voltar aos projetos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="editor">
      <TopBar onExport={() => setExporting(true)} onHelp={openHelp} onToggleProps={() => setPropsOpen(!propsOpen)} />

      {saveState === 'conflict' && (
        <div className="flex items-center gap-3 border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs" role="alert">
          <Icon name="alert" size={14} className="text-danger" />
          <span className="flex-1">Este projeto foi alterado em outra janela ou dispositivo. Suas alterações locais ainda não foram salvas.</span>
          <button
            type="button"
            className="btn !h-7"
            onClick={() =>
              void reloadFromServer()
                .then(() => toast.info('Versão do servidor carregada'))
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Falha ao recarregar'))
            }
          >
            Descartar minhas alterações
          </button>
          <button type="button" className="btn btn-primary !h-7" onClick={() => void saveNow({ overwrite: true })}>
            Sobrescrever com minha versão
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <aside className="flex shrink-0 flex-col bg-panel" style={{ width: left.size }} aria-label="Biblioteca e ferramentas">
            <div className="flex shrink-0 border-b border-line" role="tablist" aria-label="Painéis">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={panel === t.id} aria-controls="left-panel" onClick={() => setPanel(t.id)} className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-2xs transition-colors ${panel === t.id ? 'border-accent text-ink' : 'border-transparent text-mute hover:text-ink'}`} title={t.label} data-testid={`tab-${t.id}`}>
                  <Icon name={t.icon} size={16} />
                  <span className="max-w-full truncate px-0.5">{t.label}</span>
                </button>
              ))}
            </div>
            <div id="left-panel" role="tabpanel" className="min-h-0 flex-1">
              {panel === 'media' && <MediaPanel projectId={id} />}
              {panel === 'effects' && <EffectsPanel />}
              {panel === 'transitions' && <TransitionsPanel />}
              {panel === 'text' && <TextPanel />}
              {panel === 'ai' && <AiPanel projectId={id} />}
            </div>
          </aside>
          <Divider axis="x" onPointerDown={left.startDrag} onNudge={left.nudge} label="Redimensionar painel esquerdo" />

          <main className="min-w-0 flex-1" aria-label="Pré-visualização">
            <Preview />
          </main>

          <Divider axis="x" onPointerDown={right.startDrag} onNudge={(d) => right.nudge(-d)} label="Redimensionar painel de propriedades" />
          <aside className={`${propsOpen ? 'absolute bottom-0 right-0 top-12 z-40 shadow-2xl' : 'hidden'} shrink-0 bg-panel lg:static lg:block lg:shadow-none`} style={{ width: right.size }} aria-label="Propriedades">
            <Properties />
          </aside>
        </div>

        <Divider axis="y" onPointerDown={timeline.startDrag} onNudge={(d) => timeline.nudge(-d)} label="Redimensionar timeline" />
        <section className="shrink-0 bg-bg" style={{ height: timeline.size }} aria-label="Timeline">
          <Timeline />
        </section>
      </div>

      <ExportDialog projectId={id} open={exporting} onClose={() => setExporting(false)} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
