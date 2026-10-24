import { useEffect, useRef } from 'react';
import type { Marker } from '@editor/core';
import { formatRuler, RULER_H, rulerStep } from './geometry';

/**
 * Régua desenhada em canvas apenas na área visível (a timeline pode ter milhares de pixels de largura).
 * Cliques e arrastos na régua movem a cabeça de reprodução.
 */
export function Ruler({
  pps,
  scrollLeft,
  viewportW,
  width,
  markers,
  onScrub,
  onScrubEnd,
  onMarkerContext,
}: {
  pps: number;
  scrollLeft: number;
  viewportW: number;
  width: number;
  markers: Marker[];
  onScrub: (t: number) => void;
  onScrubEnd: () => void;
  onMarkerContext: (id: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.min(viewportW, width));
    c.width = w * dpr;
    c.height = RULER_H * dpr;
    c.style.width = `${w}px`;
    c.style.left = `${scrollLeft}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, RULER_H);
    const styles = getComputedStyle(document.documentElement);
    const mute = `rgb(${styles.getPropertyValue('--mute')})`;
    const line = `rgb(${styles.getPropertyValue('--line')})`;
    const { major, minor } = rulerStep(pps);
    const t0 = Math.floor(scrollLeft / pps / minor) * minor;
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.textBaseline = 'top';
    for (let t = t0; t * pps - scrollLeft < w + 40; t += minor) {
      const x = Math.round(t * pps - scrollLeft) + 0.5;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      ctx.strokeStyle = isMajor ? mute : line;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 12 : 19);
      ctx.lineTo(x, RULER_H);
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = mute;
        ctx.fillText(formatRuler(t, major), x + 4, 3);
      }
    }
  }, [pps, scrollLeft, viewportW, width]);

  return (
    <div
      className="relative cursor-pointer select-none border-b border-line bg-panel"
      style={{ height: RULER_H, width }}
      data-testid="ruler"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-marker]')) return;
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        // O canvas fica deslocado por scrollLeft; o contêiner é a faixa inteira, então usamos a posição na faixa.
        const base = el.getBoundingClientRect().left;
        onScrub((e.clientX - base) / pps);
        const move = (ev: PointerEvent) => onScrub((ev.clientX - base) / pps);
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          onScrubEnd();
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      }}
    >
      <canvas ref={ref} className="absolute top-0" aria-hidden="true" />
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          data-marker
          title={`${m.label || 'Marcador'} — clique para ir, botão direito para remover`}
          className="absolute bottom-0 z-10 -translate-x-1/2"
          style={{ left: m.time * pps, color: m.color }}
          onClick={(e) => {
            e.stopPropagation();
            onScrub(m.time);
            onScrubEnd();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onMarkerContext(m.id);
          }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
            <path d="M1 0h10v8l-5 5-5-5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
