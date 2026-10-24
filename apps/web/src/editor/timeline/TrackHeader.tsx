import { useState } from 'react';
import type { Track } from '@editor/core';
import { Icon, type IconName } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { HEADER_W } from './geometry';

const KIND: Record<Track['kind'], { icon: IconName; color: string; label: string }> = {
  video: { icon: 'film', color: 'text-clip-video', label: 'Vídeo' },
  audio: { icon: 'music', color: 'text-clip-audio', label: 'Áudio' },
  text: { icon: 'type', color: 'text-clip-text', label: 'Texto' },
  caption: { icon: 'captions', color: 'text-clip-caption', label: 'Legendas' },
};

export function TrackHeader({ track, index, selected, height }: { track: Track; index: number; selected: boolean; height: number }) {
  const patch = useEditor((s) => s.patchTrack);
  const remove = useEditor((s) => s.removeTrack);
  const select = useEditor((s) => s.selectTrack);
  const move = useEditor((s) => s.moveTrack);
  const total = useEditor((s) => s.project.tracks.length);
  const [editing, setEditing] = useState(false);
  const k = KIND[track.kind];
  const compact = height < 44;

  return (
    <div
      className={`group sticky left-0 z-20 flex shrink-0 items-center gap-1 border-b border-r border-line px-2 ${selected ? 'bg-panel2' : 'bg-panel'}`}
      style={{ width: HEADER_W, height }}
      onClick={() => select(track.id)}
      data-testid={`track-header-${track.kind}`}
    >
      <span className={k.color} title={k.label}>
        <Icon name={k.icon} size={14} />
      </span>
      {editing ? (
        <input
          autoFocus
          className="field h-6 min-w-0 flex-1 px-1.5"
          defaultValue={track.name}
          aria-label="Nome da faixa"
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== track.name) patch(track.id, { name: e.target.value.trim() });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button type="button" className="min-w-0 flex-1 truncate text-left text-xs" onDoubleClick={() => setEditing(true)} title="Duplo clique para renomear">
          {track.name}
        </button>
      )}
      <div className="flex shrink-0 items-center">
        {track.kind !== 'audio' && (
          <button type="button" className="btn-icon !h-6 !w-6" aria-label={track.hidden ? 'Mostrar faixa' : 'Ocultar faixa'} aria-pressed={track.hidden} onClick={() => patch(track.id, { hidden: !track.hidden })}>
            <Icon name={track.hidden ? 'eyeOff' : 'eye'} size={13} />
          </button>
        )}
        {(track.kind === 'video' || track.kind === 'audio') && (
          <button type="button" className="btn-icon !h-6 !w-6" aria-label={track.muted ? 'Ativar som da faixa' : 'Silenciar faixa'} aria-pressed={track.muted} onClick={() => patch(track.id, { muted: !track.muted })}>
            <Icon name={track.muted ? 'volumeOff' : 'volume'} size={13} />
          </button>
        )}
        <button type="button" className="btn-icon !h-6 !w-6" aria-label={track.locked ? 'Desbloquear faixa' : 'Bloquear faixa'} aria-pressed={track.locked} onClick={() => patch(track.id, { locked: !track.locked })}>
          <Icon name={track.locked ? 'lock' : 'unlock'} size={13} />
        </button>
        {!compact && (
          <>
            <button type="button" className="btn-icon !h-6 !w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Mover faixa para cima" disabled={index === 0} onClick={() => move(track.id, index - 1)}>
              <Icon name="chevronDown" size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </>
        )}
        <button type="button" className="btn-icon !h-6 !w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Remover faixa ${track.name}`} onClick={() => remove(track.id)} disabled={total === 0}>
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}
