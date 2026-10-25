import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useEditor } from '../store/editor';
import { buildCommands, searchCommands } from './commands';

/** Paleta de comandos (Ctrl+K): busca qualquer ação do editor por nome, sem acento. */
export function CommandPalette({ open, onClose, onExport, onHelp }: { open: boolean; onClose: () => void; onExport: () => void; onHelp: () => void }) {
  const navigate = useNavigate();
  const setPanel = useEditor((s) => s.setPanel);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo(
    () =>
      buildCommands({
        openPanel: (t) => {
          setPanel(t);
          try {
            localStorage.setItem('editor.layout.panelOpen', '1');
          } catch {
            /* ignora */
          }
          window.dispatchEvent(new Event('editor:open-panel'));
        },
        onExport,
        onHelp,
        goHome: () => navigate('/'),
      }),
    [navigate, onExport, onHelp, setPanel],
  );
  // `enabled` é avaliado a cada abertura: depende da seleção atual.
  const results = useMemo(() => (open ? searchCommands(commands, query).filter((c) => c.enabled?.() ?? true) : []), [commands, query, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (i: number) => {
    const c = results[i];
    if (!c) return;
    onClose();
    // Executa depois de fechar para o foco voltar ao editor antes da ação.
    setTimeout(() => c.run(), 0);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-[14vh] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-pop" role="dialog" aria-modal="true" aria-label="Paleta de comandos" initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.14 }}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon name="search" size={16} className="text-mute" />
              <input
                ref={input}
                role="combobox"
                aria-expanded="true"
                aria-controls="cmd-list"
                aria-activedescendant={results[index] ? `cmd-${results[index]!.id}` : undefined}
                aria-label="Buscar comandos"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-mute/70"
                placeholder="Digite um comando… (ex.: dividir, exportar, tema)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIndex((i) => Math.min(results.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIndex((i) => Math.max(0, i - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    run(index);
                  } else if (e.key === 'Escape') {
                    onClose();
                  }
                }}
              />
              <span className="kbd">Esc</span>
            </div>
            <ul ref={listRef} id="cmd-list" role="listbox" aria-label="Comandos" className="max-h-[48vh] overflow-auto p-1.5" data-testid="command-list">
              {results.length === 0 && <li className="px-4 py-8 text-center text-xs text-mute">Nenhum comando encontrado para “{query}”.</li>}
              {results.map((c, i) => (
                <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === index} onMouseMove={() => setIndex(i)} onClick={() => run(i)} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs ${i === index ? 'bg-accent/15 text-ink' : 'text-ink/85'}`}>
                  <Icon name={c.icon} size={15} className={i === index ? 'text-accent' : 'text-mute'} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-2xs text-mute">{c.group}</span>
                  {c.shortcut && <span className="kbd">{c.shortcut}</span>}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
