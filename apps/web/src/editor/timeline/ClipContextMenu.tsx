import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { buildCommands, type Command } from '../commands';

/** Ids dos comandos oferecidos no menu de contexto de um clipe, em grupos separados por linha. */
export const CLIP_MENU_GROUPS: string[][] = [
  ['split', 'duplicate', 'copy', 'paste', 'delete', 'ripple'],
  ['copy-attrs', 'paste-attrs', 'reset-visuals'],
  ['mute-clip', 'speed-2', 'speed-0.5', 'repeat-2', 'extend', 'freeze', 'extract'],
  ['zoom-sel', 'group'],
];

const noop = () => {};

/** Comandos do menu já resolvidos (apenas os que existem), mantendo os grupos. */
export function clipMenuItems(): Command[][] {
  const all = new Map(buildCommands({ openPanel: noop, onExport: noop, onHelp: noop, goHome: noop }).map((c) => [c.id, c]));
  return CLIP_MENU_GROUPS.map((ids) => ids.map((id) => all.get(id)).filter((c): c is Command => !!c)).filter((g) => g.length > 0);
}

/** Menu de contexto (botão direito) de um clipe da timeline. */
export function ClipContextMenu({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const groups = useMemo(() => clipMenuItems(), []);

  // Mantém o menu inteiro dentro da janela.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
  }, [x, y]);

  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" aria-label="Ações do clipe" className="fixed z-[80] w-64 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-pop" style={{ left: pos.x, top: pos.y }} data-testid="clip-menu" onContextMenu={(e) => e.preventDefault()}>
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-1 border-t border-line pt-1' : ''}>
          {group.map((c) => {
            const enabled = c.enabled?.() ?? true;
            return (
              <button
                key={c.id}
                role="menuitem"
                type="button"
                disabled={!enabled}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs hover:bg-panel-3 disabled:opacity-40 disabled:hover:bg-transparent"
                onClick={() => {
                  onClose();
                  setTimeout(() => c.run(), 0);
                }}
              >
                <Icon name={c.icon} size={14} className="text-mute" />
                <span className="flex-1 truncate">{c.label}</span>
                {c.shortcut && <span className="kbd">{c.shortcut}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
