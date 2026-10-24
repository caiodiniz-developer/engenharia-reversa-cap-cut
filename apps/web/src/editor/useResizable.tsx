import { useCallback, useEffect, useState } from 'react';

function load(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = Number(localStorage.getItem(`editor.layout.${key}`));
    return Number.isFinite(v) && v >= min && v <= max && v !== 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Tamanho persistente de um painel redimensionável. `startDrag` é para o onPointerDown do divisor;
 * `nudge` serve ao teclado (setas). `invert` inverte o sentido (painéis ancorados à direita/embaixo).
 */
export function useResizable(key: string, initial: number, min: number, max: number, axis: 'x' | 'y', invert = false) {
  const [size, setSize] = useState(() => load(key, initial, min, max));

  useEffect(() => {
    try {
      localStorage.setItem(`editor.layout.${key}`, String(Math.round(size)));
    } catch {
      /* sem armazenamento: o layout só vale nesta sessão */
    }
  }, [key, size]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const start = axis === 'x' ? e.clientX : e.clientY;
      const base = size;
      const move = (ev: PointerEvent) => {
        const delta = (axis === 'x' ? ev.clientX : ev.clientY) - start;
        setSize(Math.min(max, Math.max(min, base + (invert ? -delta : delta))));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [axis, invert, max, min, size],
  );

  const nudge = useCallback((delta: number) => setSize((s) => Math.min(max, Math.max(min, s + delta))), [max, min]);
  return { size, startDrag, nudge };
}

export function Divider({ axis, onPointerDown, onNudge, label }: { axis: 'x' | 'y'; onPointerDown: (e: React.PointerEvent) => void; onNudge: (delta: number) => void; label: string }) {
  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10;
        if (e.key === (axis === 'x' ? 'ArrowLeft' : 'ArrowUp')) onNudge(-step);
        if (e.key === (axis === 'x' ? 'ArrowRight' : 'ArrowDown')) onNudge(step);
      }}
      className={`group relative z-10 shrink-0 bg-line outline-none transition-colors hover:bg-accent focus-visible:bg-accent ${axis === 'x' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'}`}
    >
      <span className={`absolute ${axis === 'x' ? '-left-1.5 top-0 h-full w-3' : '-top-1.5 left-0 h-3 w-full'}`} />
    </div>
  );
}
