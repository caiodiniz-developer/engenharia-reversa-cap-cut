import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { saveNow } from '../store/persist';
import { selectCanRedo, selectCanUndo, useEditor } from '../store/editor';
import { useJobs } from '../store/jobs';
import { HistoryList, JobsList, Popover, SaveBadge } from './Popovers';

export function TopBar({ onExport, onHelp, onToggleProps }: { onExport: () => void; onHelp: () => void; onToggleProps: () => void }) {
  const name = useEditor((s) => s.project.name);
  const rename = useEditor((s) => s.rename);
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const saveState = useEditor((s) => s.saveState);
  const activeJobs = useJobs((s) => Object.values(s.jobs).filter((j) => (j.status === 'running' || j.status === 'queued') && j.type !== 'media.process').length);
  const processing = useJobs((s) => Object.values(s.jobs).filter((j) => (j.status === 'running' || j.status === 'queued') && j.type === 'media.process').length);
  const [menu, setMenu] = useState<'history' | 'jobs' | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const commitName = () => {
    if (draft !== null && draft.trim() && draft.trim() !== name) rename(draft.trim());
    setDraft(null);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3" data-testid="topbar">
      <Link to="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg" aria-label="Voltar aos projetos" title="Voltar aos projetos">
        <Icon name="play" size={14} />
      </Link>
      <input
        className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none hover:border-line focus:border-accent focus:bg-bg"
        aria-label="Nome do projeto"
        value={draft ?? name}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      <SaveBadge />
      {(saveState === 'dirty' || saveState === 'offline' || saveState === 'error') && (
        <button type="button" className="btn !h-7 px-2 text-2xs" onClick={() => void saveNow()}>
          Salvar agora
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
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
          <Popover open={menu === 'history'} onClose={() => setMenu(null)} width={280}>
            <HistoryList onDone={() => setMenu(null)} />
          </Popover>
        </div>

        <div className="relative">
          <button type="button" data-popover-trigger className="btn-icon relative" aria-label="Tarefas em andamento" aria-pressed={menu === 'jobs'} title="Tarefas" onClick={() => setMenu(menu === 'jobs' ? null : 'jobs')} data-testid="jobs-button">
            <Icon name="layers" />
            {activeJobs + processing > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg" data-testid="jobs-badge">
                {activeJobs + processing}
              </span>
            )}
          </button>
          <Popover open={menu === 'jobs'} onClose={() => setMenu(null)} width={300}>
            <JobsList />
          </Popover>
        </div>

        <button type="button" className="btn-icon" aria-label="Atalhos de teclado" title="Atalhos (?)" onClick={onHelp}>
          <Icon name="keyboard" />
        </button>
        <button type="button" className="btn-icon lg:hidden" aria-label="Painel de propriedades" title="Propriedades" onClick={onToggleProps}>
          <Icon name="panelRight" />
        </button>
        <button type="button" className="btn btn-primary ml-2 h-8" onClick={onExport} data-testid="export-button">
          <Icon name="download" size={14} /> Exportar
        </button>
      </div>
    </header>
  );
}
