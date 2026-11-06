import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { placeTooltip, type Placement } from '../lib/tooltipPlacement';

const DELAY = 450;

/**
 * Tooltip de vidro para o conteúdo dentro dele. Os eventos vêm de um invólucro (e não do botão), porque botões
 * desabilitados não disparam eventos de mouse. O botão continua com o próprio aria-label: o tooltip é um complemento visual.
 */
export function Tooltip({ label, shortcut, hint, className = 'inline-flex', children }: { label: string; shortcut?: string; hint?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((el: HTMLElement) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      target.current = el;
      setOpen(true);
    }, DELAY);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPlace(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !target.current || !tip.current) return;
    const r = target.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    setPlace(placeTooltip({ left: r.left, top: r.top, width: r.width, height: r.height }, { width: t.width, height: t.height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, label, shortcut, hint]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span className={className} onMouseEnter={(e) => show(e.currentTarget)} onFocus={(e) => show(e.currentTarget)} onMouseLeave={hide} onBlur={hide} onPointerDown={hide}>
      {children}
      {open &&
        createPortal(
          <div
            ref={tip}
            role="tooltip"
            className="glass-strong pointer-events-none fixed z-[90] flex max-w-[240px] flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-2xs leading-snug"
            style={{ left: place?.x ?? -9999, top: place?.y ?? -9999, opacity: place ? 1 : 0 }}
            data-side={place?.side}
            data-testid="tooltip"
          >
            <span className="flex items-center gap-2 font-medium">
              {label}
              {shortcut && <span className="kbd">{shortcut}</span>}
            </span>
            {hint && <span className="text-mute">{hint}</span>}
          </div>,
          document.body,
        )}
    </span>
  );
}
