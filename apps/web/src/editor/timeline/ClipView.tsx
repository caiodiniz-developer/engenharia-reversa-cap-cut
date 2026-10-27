import { memo, useEffect, useRef } from 'react';
import type { Clip, MediaClip } from '@editor/core';
import type { MediaItem } from '../../api/types';
import { Icon } from '../../components/Icon';
import { clipTooltip } from './clipInfo';
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
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const n = peaks.length;
    const i0 = from * n;
    const span = Math.max(1e-6, (to - from) * n);
    for (let x = 0; x < w; x += 2) {
      const a = Math.floor(i0 + (x / w) * span);
      const b = Math.max(a + 1, Math.floor(i0 + ((x + 2) / w) * span));
      let m = 0;
      for (let i = Math.max(0, a); i < Math.min(n, b); i++) m = Math.max(m, peaks[i]!);
      const h = Math.max(1.5, m * height * 0.92);
      ctx.fillRect(x, (height - h) / 2, 1.5, h);
    }
  }, [peaks, from, to, width, height]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/**
 * Miniaturas de quadros ao longo do clipe. Cada "casa" mostra a miniatura do instante de origem que cai
 * nela (respeitando início, velocidade e reverso). Só as casas visíveis na janela da timeline são criadas.
 */
function Filmstrip({ clip, media, pps, height, view }: { clip: MediaClip; media: MediaItem; pps: number; height: number; view: { from: number; to: number } }) {
  const film = media.film!;
  const url = media.urls.film!;
  const scale = height / film.tileH;
  const slotW = film.tileW * scale;
  const clipX = clip.start * pps;
  const width = clip.duration * pps;
  const first = Math.max(0, Math.floor((view.from - clipX) / slotW));
  const last = Math.min(Math.ceil(width / slotW), Math.ceil((view.to - clipX) / slotW));
  const slots: number[] = [];
  for (let i = first; i < last && slots.length < 400; i++) slots.push(i);
  const winEnd = clip.sourceIn + clip.duration * clip.speed;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {slots.map((i) => {
        const frac = Math.min(1, ((i + 0.5) * slotW) / Math.max(1, width));
        const t = clip.freeze ? clip.sourceIn : clip.reverse ? winEnd - frac * clip.duration * clip.speed : clip.sourceIn + frac * clip.duration * clip.speed;
        const idx = Math.max(0, Math.min(film.count - 1, Math.floor(t / film.interval)));
        return (
          <div
            key={i}
            className="absolute top-0"
            style={{
              left: i * slotW,
              width: slotW,
              height,
              backgroundImage: `url(${url})`,
              backgroundSize: `${film.count * slotW}px ${height}px`,
              backgroundPosition: `${-idx * slotW}px 0`,
            }}
          />
        );
      })}
    </div>
  );
}

export interface ClipViewProps {
  clip: Clip;
  trackKind: string;
  trackLocked: boolean;
  pps: number;
  selected: boolean;
  media: MediaItem | undefined;
  height: number;
  /** Janela visível da timeline em pixels (quantizada), para não criar miniaturas fora da tela. */
  view: { from: number; to: number };
  onPointerDown: (e: React.PointerEvent, clip: Clip) => void;
  onTrimDown: (e: React.PointerEvent, clip: Clip, edge: 'start' | 'end') => void;
}

function ClipViewBase({ clip, trackKind, trackLocked, pps, selected, media, height, view, onPointerDown, onTrimDown }: ClipViewProps) {
  const width = Math.max(2, clip.duration * pps);
  const inner = height - 8;
  const mc = clip.type === 'media' ? (clip as MediaClip) : undefined;
  const showFilm = !!mc && trackKind === 'video' && !!media?.film && !!media.urls.film && media.status === 'ready';
  const showWave = mc && media?.hasAudio && (trackKind === 'audio' || media.kind === 'audio' || (!showFilm && height >= 56));
  const peaks = useWaveform(showWave ? media?.id : undefined, media?.urls.waveform);
  const srcFrom = mc && media && media.duration > 0 ? mc.sourceIn / media.duration : 0;
  const srcTo = mc && media && media.duration > 0 ? Math.min(1, (mc.sourceIn + mc.duration * mc.speed) / media.duration) : 1;
  const label = clip.type === 'media' ? (media?.name ?? 'Mídia') : clip.text.replace(/\s+/g, ' ');
  const effects = mc?.effects.filter((e) => e.enabled).length ?? 0;
  const kfCount = Object.values(clip.keyframes).reduce((n, k) => n + (k?.length ?? 0), 0);
  const thumb = mc && trackKind === 'video' && !showFilm ? media?.urls.thumb : null;
  const wide = width > 56;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}${selected ? ' (selecionado)' : ''}`}
      aria-pressed={selected}
      data-clip-id={clip.id}
      title={clipTooltip(clip, label)}
      data-selected={selected}
      className={`group absolute top-1 overflow-hidden rounded-lg text-white outline-none transition-shadow ${COLORS[trackKind] ?? 'bg-clip-video'} ${
        selected ? 'z-10 shadow-[0_0_0_2px_rgb(var(--ink)),0_4px_14px_rgba(0,0,0,.45)]' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.35)] hover:brightness-110'
      } ${trackLocked ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
      style={{
        left: clip.start * pps,
        width,
        height: inner,
        backgroundImage: thumb ? `linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.3)), url(${thumb})` : undefined,
        backgroundSize: thumb ? 'auto 100%' : undefined,
        backgroundRepeat: thumb ? 'repeat-x' : undefined,
      }}
      onPointerDown={(e) => onPointerDown(e, clip)}
    >
      {showFilm && mc && media && <Filmstrip clip={mc} media={media} pps={pps} height={inner} view={view} />}
      {showWave && peaks && <Waveform peaks={peaks} from={srcFrom} to={srcTo} width={width} height={showFilm ? 22 : inner - 2} />}

      {/* faixa de rótulo (legível sobre qualquer miniatura) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 bg-gradient-to-b from-black/65 to-transparent px-1.5 pb-3 pt-0.5 text-2xs font-medium leading-tight">
        {mc?.linkId && wide && <Icon name="link" size={10} />}
        {mc?.reverse && wide && <Icon name="rewind" size={10} />}
        {mc && mc.speed !== 1 && wide && <span className="rounded bg-black/50 px-1 font-mono">{mc.speed}×</span>}
        {mc?.audio.muted && wide && <Icon name="volumeOff" size={10} />}
        {mc && !mc.audio.muted && Math.abs(mc.audio.volume - 1) > 1e-6 && wide && <span className="rounded bg-black/50 px-1 font-mono">{Math.round(mc.audio.volume * 100)}%</span>}
        {mc?.freeze && wide && <Icon name="snowflake" size={10} />}
        {effects > 0 && wide && <Icon name="wand" size={10} />}
        {mc && mc.stabilize > 0 && wide && <Icon name="maximize" size={10} />}
        {kfCount > 0 && wide && <Icon name="diamond" size={9} />}
        {wide && <span className="truncate drop-shadow">{label}</span>}
      </div>

      {mc && mc.audio.fadeIn > 0 && (
        <div className="pointer-events-none absolute bottom-0 left-0 h-3 bg-gradient-to-tr from-black/60 via-black/25 to-transparent" style={{ width: Math.min(width, mc.audio.fadeIn * pps), clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} data-testid="fade-in-ramp" />
      )}
      {mc && mc.audio.fadeOut > 0 && (
        <div className="pointer-events-none absolute bottom-0 right-0 h-3 bg-gradient-to-tl from-black/60 via-black/25 to-transparent" style={{ width: Math.min(width, mc.audio.fadeOut * pps), clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} data-testid="fade-out-ramp" />
      )}

      {mc?.transitionIn && <div className="pointer-events-none absolute left-0 top-0 h-full bg-gradient-to-r from-white/60 to-transparent" style={{ width: Math.max(4, mc.transitionIn.duration * pps) }} title={`Transição: ${mc.transitionIn.type}`} />}
      {clip.type === 'caption' && clip.words.length > 0 && width > 40 && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-1">
          {clip.words.map((w, i) => (
            <span key={i} className="absolute h-full bg-white/70" style={{ left: w.start * pps, width: Math.max(1, (w.end - w.start) * pps - 1) }} />
          ))}
        </div>
      )}

      {!trackLocked && (
        <>
          <div data-trim="start" className="absolute left-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center bg-white/0 hover:bg-white/35" onPointerDown={(e) => onTrimDown(e, clip, 'start')}>
            <span className={`h-5 w-0.5 rounded-full bg-white/80 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          </div>
          <div data-trim="end" className="absolute right-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center bg-white/0 hover:bg-white/35" onPointerDown={(e) => onTrimDown(e, clip, 'end')}>
            <span className={`h-5 w-0.5 rounded-full bg-white/80 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          </div>
        </>
      )}
    </div>
  );
}

export const ClipView = memo(ClipViewBase);
