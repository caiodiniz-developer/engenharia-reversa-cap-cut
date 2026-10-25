import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { saveNow } from '../store/persist';
import { selectCanRedo, selectCanUndo, useEditor } from '../store/editor';
import { useJobs } from '../store/jobs';
import { useTheme } from '../store/theme';
import { HistoryList, JobsList, Popover, SaveBadge } from './Popovers';

export function TopBar({ onExport, onHelp, onPalette, onToggleProps }: { onExport: () => void; onHelp: () => void; onPalette: () => void; onToggleProps: () => void }) {
  const name = useEditor((s) => s.project.name);
  const rename = useEditor((s) => s.rename);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const saveState = useEditor((s) => s.saveState);
  const activeJobs = useJobs((s) => Object.values(s.jobs).filter((j) => j.status === 'running' || j.status === 'queued').length);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const [menu, setMenu] = useState<'history' | 'jobs' | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const commitName = () => {
    if (draft !== null && draft.trim() && draft.trim() !== name) rename(draft.trim());
    setDraft(null);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3" data-testid="topbar">
      <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink transition-transform hover:scale-105" aria-label="Voltar aos projetos" title="Voltar aos projetos">
        <Icon name="play" size={14} />
      </Link>

      <nav className="flex min-w-0 items-center gap-1 text-xs text-mute" aria-label="Localização">
        <Link to="/" className="hidden rounded px-1 hover:text-ink sm:inline">
          Projetos
        </Link>
        <Icon name="chevronRight" size={12} className="hidden sm:block" />
        <input
          className="h-8 w-56 max-w-[40vw] rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold text-ink outline-none hover:border-line focus:border-accent focus:bg-bg"
          aria-label="Nome do projeto"
          value={draft ?? name}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
      </nav>

      <SaveBadge />
      {(saveState === 'dirty' || saveState === 'offline' || saveState === 'error') && (
        <button type="button" className="btn !h-7 px-2 text-2xs" onClick={() => void saveNow()}>
          Salvar agora
        </button>
      )}

      <button type="button" className="mx-auto hidden h-8 w-72 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-xs text-mute transition-colors hover:border-mute/40 hover:text-ink lg:flex" onClick={onPalette} aria-label="Buscar comandos (Ctrl+K)" data-testid="palette-button">
        <Icon name="search" size={14} />
        <span className="flex-1 text-left">Buscar comandos…</span>
        <span className="kbd">Ctrl K</span>
      </button>

      <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
        <button type="button" className="btn-icon lg:hidden" aria-label="Buscar comandos" onClick={onPalette}>
          <Icon name="search" />
        </button>
        <button type="button" className="btn-icon" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="btn-icon" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Icon name="redo" />
        </button>

        <div className="relative">
          <button type="button" data-popover-trigger className="btn-icon" aria-label="Histórico de operações" aria-pressed={menu === 'history'} title="Histórico de operações" onClick={() => setMenu(menu === 'history' ? null : 'history')}>
            <Icon name="history" />
          </button>
          <Popover open={menu === 'history'} onClose={() => setMenu(null)} width={290}>
            <HistoryList onDone={() => setMenu(null)} />
          </Popover>
        </div>

        <div className="relative">
          <button type="button" data-popover-trigger className="btn-icon relative" aria-label="Tarefas em andamento" aria-pressed={menu === 'jobs'} title="Tarefas" onClick={() => setMenu(menu === 'jobs' ? null : 'jobs')} data-testid="jobs-button">
            <Icon name="layers" />
            {activeJobs > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-ink" data-testid="jobs-badge">
                {activeJobs}
              </span>
            )}
          </button>
          <Popover open={menu === 'jobs'} onClose={() => setMenu(null)} width={310}>
            <JobsList />
          </Popover>
        </div>

        <button type="button" className="btn-icon" aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'} title="Alternar tema" onClick={toggleTheme} data-testid="theme-toggle">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button type="button" className="btn-icon" aria-label="Atalhos de teclado" title="Atalhos (?)" onClick={onHelp}>
          <Icon name="keyboard" />
        </button>
        <button type="button" className="btn-icon lg:hidden" aria-label="Painel de propriedades" title="Propriedades" onClick={onToggleProps}>
          <Icon name="panelRight" />
        </button>
        <button type="button" className="btn btn-primary ml-2 h-8 px-4 shadow-sm" onClick={onExport} data-testid="export-button">
          <Icon name="download" size={14} /> Exportar
        </button>
      </div>
    </header>
  );
}
