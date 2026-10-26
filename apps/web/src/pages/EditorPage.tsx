import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { MediaItem, ProjectDoc } from '../api/types';
import { Icon } from '../components/Icon';
import { CommandPalette } from '../editor/CommandPalette';
import { ExportDialog } from '../editor/ExportDialog';
import { StatusBar } from '../editor/StatusBar';
import { VersionsDialog } from '../editor/VersionsDialog';
import { AiPanel } from '../editor/panels/AiPanel';
import { AnimationsPanel } from '../editor/panels/AnimationsPanel';
import { AudioPanel } from '../editor/panels/AudioPanel';
import { EffectsPanel } from '../editor/panels/EffectsPanel';
import { ElementsPanel } from '../editor/panels/ElementsPanel';
import { MediaPanel } from '../editor/panels/MediaPanel';
import { TextPanel } from '../editor/panels/TextPanel';
import { TransitionsPanel } from '../editor/panels/TransitionsPanel';
import { ShortcutsDialog } from '../editor/Popovers';
import { Preview } from '../editor/Preview';
import { Properties } from '../editor/props/Properties';
import { Timeline } from '../editor/timeline/Timeline';
import { TopBar } from '../editor/TopBar';
import { TOOLS, ToolRail } from '../editor/ToolRail';
import { useShortcuts } from '../editor/useShortcuts';
import { Divider, useResizable } from '../editor/useResizable';
import { useEditor } from '../store/editor';
import { bindEvents } from '../store/jobs';
import { recoverDraft, reloadFromServer, saveNow, startAutosave } from '../store/persist';
import { toast } from '../store/toasts';

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

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`editor.layout.${key}`);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function EditorPage() {
  const { id = '' } = useParams();
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [exporting, setExporting] = useState(false);
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => loadFlag('panelOpen', true));
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  const saveState = useEditor((s) => s.saveState);
  const left = useResizable('left', 320, 260, 520, 'x');
  const right = useResizable('right', 330, 280, 520, 'x', true);
  const timeline = useResizable('timeline', 320, 180, 680, 'y', true);
  const openHelp = useCallback(() => setHelp(true), []);
  const openPalette = useCallback(() => setPalette(true), []);
  useShortcuts(openHelp, openPalette);

  const togglePanel = (open: boolean) => {
    setPanelOpen(open);
    try {
      localStorage.setItem('editor.layout.panelOpen', open ? '1' : '0');
    } catch {
      /* ignora */
    }
  };

  // A paleta de comandos pede para abrir um painel (e ele precisa estar visível).
  const [versionsOpen, setVersionsOpen] = useState(false);
  useEffect(() => {
    const open = () => setVersionsOpen(true);
    window.addEventListener('editor:open-versions', open);
    return () => window.removeEventListener('editor:open-versions', open);
  }, []);

  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener('editor:open-panel', open);
    return () => window.removeEventListener('editor:open-panel', open);
  }, []);

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
      <div className="flex h-full items-center justify-center gap-3 text-xs text-mute" role="status">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" /> Abrindo projeto…
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

  const tool = TOOLS.find((t) => t.id === panel)!;

  return (
    <div className="flex h-full flex-col bg-bg" data-testid="editor">
      <TopBar onExport={() => setExporting(true)} onHelp={openHelp} onPalette={openPalette} onToggleProps={() => setPropsOpen(!propsOpen)} />

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
        <div className="relative flex min-h-0 flex-1">
          <ToolRail
            value={panel}
            onChange={(t) => {
              setPanel(t);
              togglePanel(true);
            }}
          />

          {panelOpen && (
            <>
              <aside className="flex shrink-0 flex-col bg-panel" style={{ width: left.size }} aria-label="Biblioteca e ferramentas">
                <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{tool.label}</h2>
                  </div>
                  <button type="button" className="btn-icon" aria-label="Recolher painel" title="Recolher painel" onClick={() => togglePanel(false)}>
                    <Icon name="chevronDown" size={15} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                </header>
                <div id="left-panel" role="tabpanel" className="min-h-0 flex-1">
                  {panel === 'media' && <MediaPanel projectId={id} />}
                  {panel === 'audio' && <AudioPanel projectId={id} />}
                  {panel === 'text' && <TextPanel />}
                  {panel === 'effects' && <EffectsPanel />}
                  {panel === 'transitions' && <TransitionsPanel />}
                  {panel === 'animations' && <AnimationsPanel />}
                  {panel === 'elements' && <ElementsPanel projectId={id} />}
                  {panel === 'ai' && <AiPanel projectId={id} />}
                </div>
              </aside>
              <Divider axis="x" onPointerDown={left.startDrag} onNudge={left.nudge} label="Redimensionar painel esquerdo" />
            </>
          )}

          <main className="min-w-0 flex-1" aria-label="Pré-visualização">
            <Preview />
          </main>

          <Divider axis="x" onPointerDown={right.startDrag} onNudge={(d) => right.nudge(-d)} label="Redimensionar painel de propriedades" />
          <aside className={`${propsOpen ? 'absolute bottom-0 right-0 top-0 z-40 shadow-pop' : 'hidden'} shrink-0 bg-panel lg:static lg:block lg:shadow-none`} style={{ width: right.size }} aria-label="Propriedades">
            <Properties />
          </aside>
        </div>

        <Divider axis="y" onPointerDown={timeline.startDrag} onNudge={(d) => timeline.nudge(-d)} label="Redimensionar timeline" />
        <section className="shrink-0 bg-bg" style={{ height: timeline.size }} aria-label="Timeline">
          <Timeline />
        </section>
      </div>

      <StatusBar />

      <ExportDialog projectId={id} open={exporting} onClose={() => setExporting(false)} />
      <VersionsDialog projectId={id} open={versionsOpen} onClose={() => setVersionsOpen(false)} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onExport={() => setExporting(true)} onHelp={openHelp} />
    </div>
  );
}
