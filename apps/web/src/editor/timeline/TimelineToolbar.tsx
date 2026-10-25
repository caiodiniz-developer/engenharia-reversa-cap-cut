import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { findClip, projectDuration, type TrackKind } from '@editor/core';
import { Icon, type IconName } from '../../components/Icon';
import { MAX_ZOOM, MIN_ZOOM, selectCanRedo, selectCanUndo, useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

function Tool({ icon, label, onClick, disabled, pressed, shortcut }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; shortcut?: string }) {
  return (
    <button type="button" className="btn-icon" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} onClick={onClick} disabled={disabled} aria-pressed={pressed}>
      <Icon name={icon} />
    </button>
  );
}

const Sep = () => <span className="mx-1.5 h-5 w-px bg-line" aria-hidden="true" />;

export function TimelineToolbar() {
  // Assina só o necessário: o cursor muda a cada quadro e não deve re-renderizar a barra de ferramentas.
  const sel = useEditor(useShallow((st) => ({ selection: st.selection, project: st.project, snapping: st.snapping, zoom: st.zoom, selectedTrackId: st.selectedTrackId })));
  const s = { ...useEditor.getState(), ...sel };
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const [adding, setAdding] = useState(false);
  const hasSel = s.selection.length > 0;
  const one = s.selection.length === 1 ? findClip(s.project, s.selection[0]!)?.clip : undefined;
  const isVideoMedia = one?.type === 'media' && s.project.media[one.mediaId]?.kind === 'video';
  const canExtract = isVideoMedia && s.project.media[(one as { mediaId: string }).mediaId]?.hasAudio && !(one as { audio: { muted: boolean } }).audio.muted;
  const linked = s.selection.some((id) => findClip(s.project, id)?.clip.linkId);
  const total = projectDuration(s.project);

  const fit = () => {
    const el = document.querySelector<HTMLElement>('[data-testid="timeline"]');
    const w = (el?.clientWidth ?? 900) - 220;
    if (total > 0) s.setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, w / total)));
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-line bg-panel px-3" role="toolbar" aria-label="Ferramentas da timeline">
      <Tool icon="undo" label="Desfazer" shortcut="Ctrl+Z" onClick={s.undo} disabled={!canUndo} />
      <Tool icon="redo" label="Refazer" shortcut="Ctrl+Shift+Z" onClick={s.redo} disabled={!canRedo} />
      <Sep />
      <Tool icon="scissors" label="Dividir na cabeça de reprodução" shortcut="S" onClick={s.splitAtPlayhead} />
      <Tool icon="trash" label="Excluir" shortcut="Delete" onClick={() => s.deleteSelection(false)} disabled={!hasSel} />
      <button type="button" className="btn-icon w-auto gap-1 px-1.5 text-2xs" title="Excluir e fechar o espaço (Shift+Delete)" aria-label="Excluir e fechar espaço" onClick={() => s.deleteSelection(true)} disabled={!hasSel}>
        <Icon name="trash" size={13} />
        <Icon name="shuffle" size={11} />
      </button>
      <Tool icon="copy" label="Duplicar" shortcut="Ctrl+D" onClick={s.duplicateSelection} disabled={!hasSel} />
      <Sep />
      <Tool icon="mic" label="Extrair áudio do vídeo" onClick={() => one && s.extractAudioOf(one.id)} disabled={!canExtract} />
      <Tool icon="unlink" label="Desvincular áudio e vídeo" onClick={() => s.unlink(s.selection)} disabled={!linked} />
      <Tool icon="group" label="Agrupar clipes" shortcut="Ctrl+G" onClick={() => s.group(s.selection)} disabled={s.selection.length < 2} />
      <Tool icon="snowflake" label="Congelar quadro" onClick={() => one && s.freeze(one.id)} disabled={!isVideoMedia} />
      <Tool icon="flag" label="Adicionar marcador" shortcut="M" onClick={s.addMarkerAtPlayhead} />
      <Tool icon="minimize" label="Fechar espaços vazios da faixa selecionada" onClick={() => (s.selectedTrackId ? s.closeGaps(s.selectedTrackId) : toast.info('Clique no cabeçalho de uma faixa para selecioná-la'))} />
      <Sep />
      <Tool icon="magnet" label="Ímã (snap)" shortcut="N" onClick={s.toggleSnapping} pressed={s.snapping} />
      <div className="relative">
        <button type="button" className="btn h-7 px-2.5" aria-haspopup="menu" aria-expanded={adding} onClick={() => setAdding(!adding)}>
          <Icon name="plus" size={13} /> Faixa
        </button>
        {adding && (
          <div role="menu" className="absolute left-0 top-9 z-50 w-40 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-pop">
            {(['video', 'audio', 'text', 'caption'] as TrackKind[]).map((k) => (
              <button
                key={k}
                role="menuitem"
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-line/60"
                onClick={() => {
                  s.addTrack(k);
                  setAdding(false);
                }}
              >
                {{ video: 'Vídeo', audio: 'Áudio', text: 'Texto', caption: 'Legendas' }[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tool icon="zoomOut" label="Diminuir zoom" shortcut="-" onClick={() => s.setZoom(s.zoom / 1.3)} />
        <input type="range" aria-label="Zoom da timeline" className="w-24" min={Math.log(MIN_ZOOM)} max={Math.log(MAX_ZOOM)} step={0.01} value={Math.log(s.zoom)} onChange={(e) => s.setZoom(Math.exp(Number(e.target.value)))} />
        <Tool icon="zoomIn" label="Aumentar zoom" shortcut="+" onClick={() => s.setZoom(s.zoom * 1.3)} />
        <button type="button" className="btn h-7 px-2 text-2xs" onClick={fit} title="Ajustar o projeto à largura da timeline">
          Ajustar
        </button>
      </div>
    </div>
  );
}
