import { useState } from 'react';
import type { Track } from '@editor/core';
import { Icon, type IconName } from '../../components/Icon';
import { useEditor } from '../../store/editor';
import { HEADER_W } from './geometry';

const KIND: Record<Track['kind'], { icon: IconName; text: string; bar: string; label: string }> = {
  video: { icon: 'film', text: 'text-clip-video', bar: 'bg-clip-video', label: 'Vídeo' },
  audio: { icon: 'music', text: 'text-clip-audio', bar: 'bg-clip-audio', label: 'Áudio' },
  text: { icon: 'type', text: 'text-clip-text', bar: 'bg-clip-text', label: 'Texto' },
  caption: { icon: 'captions', text: 'text-clip-caption', bar: 'bg-clip-caption', label: 'Legendas' },
};

function Toggle({ on, label, icon, onClick }: { on: boolean; label: string; icon: IconName; onClick: () => void }) {
  return (
    <button type="button" className={`btn-icon !h-6 !w-6 ${on ? '!text-warn' : ''}`} aria-label={label} title={label} aria-pressed={on} onClick={(e) => (e.stopPropagation(), onClick())}>
      <Icon name={icon} size={13} />
    </button>
  );
}

/**
 * Cabeçalho da faixa. Os três controles de estado (ocultar, silenciar, bloquear) ficam sempre visíveis;
 * as ações menos frequentes aparecem sobre o nome ao passar o mouse, para o nome nunca ser espremido.
 */
export function TrackHeader({ track, index, selected, height }: { track: Track; index: number; selected: boolean; height: number }) {
  const patch = useEditor((s) => s.patchTrack);
  const select = useEditor((s) => s.selectTrack);
  const move = useEditor((s) => s.moveTrack);
  const closeGaps = useEditor((s) => s.closeGaps);
  const [editing, setEditing] = useState(false);
  const k = KIND[track.kind];
  const compact = height < 48;

  return (
    <div
      className={`group sticky left-0 z-20 flex shrink-0 items-center gap-2 border-b border-r border-line pr-1.5 ${selected ? 'bg-panel-3' : 'bg-panel'}`}
      style={{ width: HEADER_W, height }}
      onClick={() => select(track.id)}
      data-testid={`track-header-${track.kind}`}
    >
      <span className={`h-full w-1 shrink-0 ${k.bar} ${track.hidden || track.muted ? 'opacity-40' : ''}`} aria-hidden="true" />
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-panel-3 ${k.text}`} title={k.label}>
        <Icon name={k.icon} size={13} />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="field h-6 w-full px-1.5"
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
          <button type="button" className="block w-full truncate text-left text-xs font-medium" onDoubleClick={() => setEditing(true)} title={`${track.name} — duplo clique para renomear`}>
            {track.name}
          </button>
        )}
        {!compact && (
          <span className="block truncate text-2xs text-mute">
            {track.clips.length} {track.clips.length === 1 ? 'clipe' : 'clipes'}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        {track.kind !== 'audio' && <Toggle on={track.hidden} label={track.hidden ? 'Mostrar faixa' : 'Ocultar faixa'} icon={track.hidden ? 'eyeOff' : 'eye'} onClick={() => patch(track.id, { hidden: !track.hidden })} />}
        {(track.kind === 'video' || track.kind === 'audio') && <Toggle on={track.muted} label={track.muted ? 'Ativar som da faixa' : 'Silenciar faixa'} icon={track.muted ? 'volumeOff' : 'volume'} onClick={() => patch(track.id, { muted: !track.muted })} />}
        <Toggle on={track.locked} label={track.locked ? 'Desbloquear faixa' : 'Bloquear faixa'} icon={track.locked ? 'lock' : 'unlock'} onClick={() => patch(track.id, { locked: !track.locked })} />
      </div>

      {/* Ações secundárias: aparecem sobre o nome ao passar o mouse ou ao focar. */}
      <div className="pointer-events-none absolute inset-y-0 left-8 right-[78px] flex items-center justify-end gap-0.5 bg-gradient-to-l from-panel-3 via-panel-3 to-transparent pl-6 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <Toggle on={false} label="Fechar espaços vazios da faixa" icon="minimize" onClick={() => closeGaps(track.id)} />
        {!compact && <Toggle on={false} label="Mover faixa para cima" icon="chevronUp" onClick={() => move(track.id, index - 1)} />}
      </div>
    </div>
  );
}
