import { useEffect, useRef, useState } from 'react';
import { formatTimecode } from '@editor/core';
import { Icon } from '../../components/Icon';
import { useEditor } from '../../store/editor';

const MARKER_COLORS = ['#f5a524', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];
const nextColor = (c: string) => MARKER_COLORS[(MARKER_COLORS.indexOf(c.toLowerCase()) + 1) % MARKER_COLORS.length]!;

/** Lista de marcadores do projeto: pular até um, renomear ou remover. */
export function MarkersPopover() {
  const markers = useEditor((s) => s.project.markers);
  const fps = useEditor((s) => s.project.settings.fps);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const go = (t: number) => {
    const st = useEditor.getState();
    st.setPlaying(false);
    st.setPlayhead(t);
  };

  return (
    <div className="relative" ref={box}>
      <button type="button" className="btn-icon relative" aria-label="Lista de marcadores" title="Lista de marcadores" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="markers-button">
        <Icon name="list" />
        {markers.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-accent px-1 text-center text-[9px] font-semibold leading-[14px] text-accent-ink">{markers.length}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Marcadores" className="absolute left-0 top-9 z-50 w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-pop" data-testid="markers-popover">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs font-semibold">Marcadores</p>
            <button type="button" className="btn h-6 px-2 text-2xs" onClick={() => useEditor.getState().addMarkerAtPlayhead()}>
              <Icon name="plus" size={12} /> Aqui
            </button>
          </div>
          {markers.length === 0 ? (
            <p className="px-3 py-4 text-center text-2xs text-mute">Nenhum marcador. Pressione M para marcar a posição da cabeça de reprodução.</p>
          ) : (
            <ul className="max-h-64 overflow-auto py-1">
              {markers.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 px-2 py-1 hover:bg-panel-3">
                  <button type="button" className="h-4 w-4 shrink-0 rounded-full border border-line" style={{ background: m.color }} title="Mudar a cor" aria-label={`Cor do marcador ${m.label || formatTimecode(m.time, fps)}: clique para mudar`} data-color={m.color} onClick={() => useEditor.getState().recolorMarker(m.id, nextColor(m.color))} />
                  <button type="button" className="tnum shrink-0 rounded-md px-1.5 py-1 font-mono text-2xs text-accent hover:bg-panel-2" title="Ir até o marcador" aria-label={`Ir ao marcador ${m.label || formatTimecode(m.time, fps)}`} onClick={() => go(m.time)}>
                    {formatTimecode(m.time, fps)}
                  </button>
                  <input className="field h-6 min-w-0 flex-1 px-1.5" aria-label={`Nome do marcador em ${formatTimecode(m.time, fps)}`} defaultValue={m.label} onBlur={(e) => e.target.value.trim() !== m.label && useEditor.getState().renameMarker(m.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                  <button type="button" className="btn-icon !h-6 !w-6" aria-label={`Remover marcador ${m.label || formatTimecode(m.time, fps)}`} onClick={() => useEditor.getState().removeMarker(m.id)}>
                    <Icon name="trash" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
