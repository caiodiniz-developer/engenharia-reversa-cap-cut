import { useShallow } from 'zustand/react/shallow';
import { projectDuration } from '@editor/core';
import { aspectLabel, formatDuration } from '../lib/format';
import { useEditor } from '../store/editor';

/** Barra de estado: formato do projeto, contagens, seleção, zoom, velocidade e trecho marcado. */
export function StatusBar() {
  const s = useEditor(
    useShallow((st) => ({
      width: st.project.settings.width,
      height: st.project.settings.height,
      fps: st.project.settings.fps,
      tracks: st.project.tracks.length,
      clips: st.project.tracks.reduce((n, t) => n + t.clips.length, 0),
      total: projectDuration(st.project),
      selected: st.selection.length,
      zoom: st.zoom,
      rate: st.rate,
      area: st.workArea,
      snapping: st.snapping,
    })),
  );
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-panel px-3 text-2xs text-mute" aria-label="Barra de estado" data-testid="status-bar">
      <span title="Formato e quadros por segundo do projeto">
        {aspectLabel(s.width, s.height)} · {s.width}×{s.height} · {s.fps} fps
      </span>
      <span className="h-3 w-px bg-line" aria-hidden="true" />
      <span>
        {s.tracks} {s.tracks === 1 ? 'faixa' : 'faixas'} · {s.clips} {s.clips === 1 ? 'clipe' : 'clipes'} · {formatDuration(s.total)}
      </span>
      {s.selected > 0 && (
        <span className="text-accent" data-testid="status-selected">
          {s.selected} {s.selected === 1 ? 'selecionado' : 'selecionados'}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        {s.area && (
          <span className="text-accent" title="Trecho marcado com I e O (Alt+X limpa)" data-testid="status-range">
            Trecho {formatDuration(s.area.start)}–{formatDuration(s.area.end)}
          </span>
        )}
        {s.rate !== 1 && <span className="text-amber-400">Preview {s.rate}×</span>}
        <span>Ímã {s.snapping ? 'ligado' : 'desligado'}</span>
        <span className="tnum">{Math.round(s.zoom)} px/s</span>
      </span>
    </footer>
  );
}
