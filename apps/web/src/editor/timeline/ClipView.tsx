import { memo, useEffect, useRef } from 'react';
import type { Clip, MediaClip } from '@editor/core';
import type { MediaItem } from '../../api/types';
import { Icon } from '../../components/Icon';
import { useWaveform } from './useWaveform';

const COLORS: Record<string, string> = {
  video: 'bg-clip-video',
  audio: 'bg-clip-audio',
  text: 'bg-clip-text',
  caption: 'bg-clip-caption',
};

function Waveform({ peaks, from, to, width, height }: { peaks: number[]; from: number; to: number; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || width < 2) return;
    const w = Math.min(Math.round(width), 4000);
    c.width = w;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, height);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const n = peaks.length;
    const i0 = from * n;
    const span = Math.max(1e-6, (to - from) * n);
    for (let x = 0; x < w; x += 2) {
      const a = Math.floor(i0 + (x / w) * span);
      const b = Math.max(a + 1, Math.floor(i0 + ((x + 2) / w) * span));
      let m = 0;
      for (let i = Math.max(0, a); i < Math.min(n, b); i++) m = Math.max(m, peaks[i]!);
      const h = Math.max(1, m * height * 0.9);
      ctx.fillRect(x, (height - h) / 2, 1.5, h);
    }
  }, [peaks, from, to, width, height]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export interface ClipViewProps {
  clip: Clip;
  trackKind: string;
  trackLocked: boolean;
  pps: number;
  selected: boolean;
  media: MediaItem | undefined;
  height: number;
  onPointerDown: (e: React.PointerEvent, clip: Clip) => void;
  onTrimDown: (e: React.PointerEvent, clip: Clip, edge: 'start' | 'end') => void;
}

function ClipViewBase({ clip, trackKind, trackLocked, pps, selected, media, height, onPointerDown, onTrimDown }: ClipViewProps) {
  const width = Math.max(2, clip.duration * pps);
  const mc = clip.type === 'media' ? (clip as MediaClip) : undefined;
  const showWave = mc && media?.hasAudio && (trackKind === 'audio' || media.kind === 'audio' || height >= 56);
  const peaks = useWaveform(showWave ? media?.id : undefined, media?.urls.waveform);
  const srcFrom = mc && media && media.duration > 0 ? mc.sourceIn / media.duration : 0;
  const srcTo = mc && media && media.duration > 0 ? Math.min(1, (mc.sourceIn + mc.duration * mc.speed) / media.duration) : 1;
  const label = clip.type === 'media' ? (media?.name ?? 'Mídia') : clip.text.replace(/\s+/g, ' ');
  const effects = mc?.effects.filter((e) => e.enabled).length ?? 0;
  const kfCount = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);
  const thumb = mc && trackKind === 'video' ? media?.urls.thumb : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}${selected ? ' (selecionado)' : ''}`}
      aria-pressed={selected}
      data-clip-id={clip.id}
      data-selected={selected}
      className={`group absolute top-1 overflow-hidden rounded-md border text-white shadow-sm outline-none ${COLORS[trackKind] ?? 'bg-clip-video'} ${
        selected ? 'z-10 border-white ring-1 ring-white/80' : 'border-black/30'
      } ${trackLocked ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
      style={{
        left: clip.start * pps,
        width,
        height: height - 8,
        backgroundImage: thumb ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url(${thumb})` : undefined,
        backgroundSize: thumb ? 'auto 100%' : undefined,
        backgroundRepeat: thumb ? 'repeat-x' : undefined,
      }}
      onPointerDown={(e) => onPointerDown(e, clip)}
    >
      {showWave && peaks && <Waveform peaks={peaks} from={srcFrom} to={srcTo} width={width} height={height - 10} />}

      <div className="pointer-events-none relative flex h-full flex-col justify-between px-1.5 py-0.5">
        <div className="flex items-center gap-1 text-2xs font-medium leading-tight drop-shadow">
          {mc?.linkId && <Icon name="link" size={10} />}
          {mc?.reverse && <Icon name="rewind" size={10} />}
          {mc && mc.speed !== 1 && <span className="rounded bg-black/40 px-1 font-mono">{mc.speed}×</span>}
          {mc?.freeze && <Icon name="snowflake" size={10} />}
          {effects > 0 && <Icon name="wand" size={10} />}
          {kfCount > 0 && <Icon name="diamond" size={9} />}
          <span className="truncate">{label}</span>
        </div>
      </div>

      {mc?.transitionIn && (
        <div className="pointer-events-none absolute left-0 top-0 h-full bg-gradient-to-r from-white/50 to-transparent" style={{ width: Math.max(4, mc.transitionIn.duration * pps) }} title={`Transição: ${mc.transitionIn.type}`} />
      )}
      {clip.type === 'caption' && clip.words.length > 0 && width > 40 && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-1">
          {clip.words.map((w, i) => (
            <span key={i} className="absolute h-full bg-white/70" style={{ left: w.start * pps, width: Math.max(1, (w.end - w.start) * pps - 1) }} />
          ))}
        </div>
      )}

      {!trackLocked && (
        <>
          <div data-trim="start" className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/50" onPointerDown={(e) => onTrimDown(e, clip, 'start')} />
          <div data-trim="end" className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/50" onPointerDown={(e) => onTrimDown(e, clip, 'end')} />
        </>
      )}
    </div>
  );
}

export const ClipView = memo(ClipViewBase);
