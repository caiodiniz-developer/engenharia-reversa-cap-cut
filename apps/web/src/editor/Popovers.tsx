import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ProgressBar } from '../components/controls';
import { Icon } from '../components/Icon';
import { groupShortcuts, splitKeyCombos } from './shortcutGroups';
import { formatRelative } from '../lib/format';
import { JOB_LABELS, useJobs } from '../store/jobs';
import { useEditor } from '../store/editor';
import { SHORTCUTS } from './useShortcuts';

export function Popover({ open, onClose, children, width = 300, align = 'right' }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-popover-trigger]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={`absolute top-10 z-50 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`} style={{ width }}>
      {children}
    </motion.div>
  );
}

/** Histórico de operações: clique em um passo para voltar a ele. */
export function HistoryList({ onDone }: { onDone: () => void }) {
  const history = useEditor((s) => s.history);
  const jump = useEditor((s) => s.jumpHistory);
  const items = history.entries.map((e, i) => ({ e, i })).reverse();
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-xs font-semibold">Histórico de operações</h3>
        <span className="text-2xs text-mute">{history.entries.length - 1} passos</span>
      </div>
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-xs text-accent hover:bg-panel-3"
        onClick={() => {
          onDone();
          window.dispatchEvent(new Event('editor:open-versions'));
        }}
      >
        <Icon name="cloud" size={13} /> Versões salvas do projeto…
      </button>
      <ol className="max-h-80 overflow-auto py-1" data-testid="history-list">
        {items.map(({ e, i }) => (
          <li key={i}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-line/50 ${i === history.index ? 'bg-accent/10 text-ink' : i > history.index ? 'text-mute/60' : 'text-ink'}`}
              onClick={() => {
                jump(i);
                onDone();
              }}
              aria-current={i === history.index}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === history.index ? 'bg-accent' : 'bg-line'}`} />
              <span className="truncate">{e.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Uso de memória do JavaScript (apenas navegadores baseados em Chromium expõem isso). */
function MemoryMeter() {
  const [mb, setMb] = useState<{ used: number; limit: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const m = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (m) setMb({ used: m.usedJSHeapSize / 1048576, limit: m.jsHeapSizeLimit / 1048576 });
    };
    read();
    const t = setInterval(read, 3000);
    return () => clearInterval(t);
  }, []);
  if (!mb) return null;
  const high = mb.used > mb.limit * 0.7;
  return (
    <p className={`border-t border-line px-3 py-2 text-2xs ${high ? 'text-danger' : 'text-mute'}`} data-testid="memory">
      Memória do navegador: {mb.used.toFixed(0)} MB{high ? ' — alta; feche abas ou reduza o zoom/efeitos do preview' : ''}
    </p>
  );
}

export function JobsList() {
  const jobs = useJobs((s) => s.jobs);
  const connected = useJobs((s) => s.connected);
  const list = Object.values(jobs)
    .filter((j) => j.type !== 'media.process' || j.status === 'running' || j.status === 'queued')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-xs font-semibold">Tarefas</h3>
        <span className={`flex items-center gap-1 text-2xs ${connected ? 'text-ok' : 'text-mute'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-ok' : 'bg-mute'}`} />
          {connected ? 'ao vivo' : 'reconectando…'}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="px-3 py-6 text-center text-2xs text-mute">Nenhuma tarefa recente.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-auto">
          {list.map((j) => (
            <li key={j.id} className="px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{JOB_LABELS[j.type] ?? j.type}</span>
                <span className={`text-2xs ${j.status === 'failed' ? 'text-danger' : j.status === 'succeeded' ? 'text-ok' : 'text-mute'}`}>
                  {{ queued: 'na fila', running: `${Math.round(j.progress * 100)}%`, succeeded: 'concluída', failed: 'falhou', cancelled: 'cancelada' }[j.status]}
                </span>
              </div>
              {(j.status === 'running' || j.status === 'queued') && (
                <>
                  <ProgressBar value={j.progress} label={JOB_LABELS[j.type] ?? j.type} />
                  <button type="button" className="mt-1 text-2xs text-mute hover:text-danger" onClick={() => void useJobs.getState().cancel(j.id)}>
                    Cancelar
                  </button>
                </>
              )}
              {j.status === 'failed' && j.error && <p className="text-2xs text-danger">{j.error}</p>}
              <p className="mt-0.5 text-2xs text-mute/70">{formatRelative(new Date(j.updatedAt).toISOString())}</p>
            </li>
          ))}
        </ul>
      )}
      <MemoryMeter />
    </div>
  );
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const groups = groupShortcuts(SHORTCUTS, query);
  return (
    <Modal open={open} onClose={onClose} title="Atalhos de teclado" width={560}>
      <input className="field mb-3" placeholder="Buscar atalho (ex.: dividir, zoom, Ctrl)" aria-label="Buscar atalho" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="max-h-[56vh] overflow-auto pr-1" data-testid="shortcut-list">
        {groups.length === 0 && <p className="py-8 text-center text-xs text-mute">Nenhum atalho corresponde a “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.category} className="mb-4" aria-label={g.category}>
            <h3 className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-mute">{g.category}</h3>
            <dl className="grid grid-cols-[minmax(0,auto)_1fr] items-center gap-x-5 gap-y-1.5 text-xs">
              {g.items.map((s) => (
                <div key={s.keys} className="contents">
                  <dt className="flex flex-wrap items-center gap-1">
                    {splitKeyCombos(s.keys).map((combo, i) => (
                      <span key={combo} className="flex items-center gap-1">
                        {i > 0 && <span className="text-mute">ou</span>}
                        <kbd className="kbd">{combo}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd className="text-mute">{s.label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}

export function SaveBadge() {
  const state = useEditor((s) => s.saveState);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const map = {
    saved: { icon: 'cloud', text: lastSavedAt ? 'Salvo' : 'Salvo', cls: 'text-mute' },
    dirty: { icon: 'cloud', text: 'Alterações pendentes', cls: 'text-amber-400' },
    saving: { icon: 'cloud', text: 'Salvando…', cls: 'text-accent' },
    error: { icon: 'alert', text: 'Erro ao salvar', cls: 'text-danger' },
    conflict: { icon: 'alert', text: 'Conflito de versão', cls: 'text-danger' },
    offline: { icon: 'cloudOff', text: 'Sem conexão — rascunho local', cls: 'text-amber-400' },
  } as const;
  const m = map[state];
  return (
    <span className={`flex items-center gap-1.5 text-2xs ${m.cls}`} role="status" aria-live="polite" data-testid="save-state" data-state={state}>
      <Icon name={m.icon} size={13} />
      {m.text}
    </span>
  );
}
