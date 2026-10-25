import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clipEnd, collectSnapPoints, findClip, formatTimecode, projectDuration, snapRange, snapTime, type Clip, type Track } from '@editor/core';
import { Icon } from '../../components/Icon';
import { MAX_ZOOM, MIN_ZOOM, useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';
import { ClipView } from './ClipView';
import { HEADER_W, RULER_H, rulerStep, trackHeight } from './geometry';
import { Ruler } from './Ruler';
import { TimelineToolbar } from './TimelineToolbar';
import { TrackHeader } from './TrackHeader';

const DRAG_THRESHOLD = 3;
const SNAP_PX = 8;

type Drag =
  | { kind: 'move'; ids: string[]; primaryId: string; startX: number; origStart: number; length: number; applied: number; active: boolean; clickSelect: boolean }
  | { kind: 'trim'; id: string; edge: 'start' | 'end' }
  | { kind: 'marquee'; x0: number; y0: number };

export function Timeline() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const zoom = useEditor((s) => s.zoom);
  const media = useEditor((s) => s.media);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const playing = useEditor((s) => s.playing);
  const store = useEditor;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 800 });
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dropTrack, setDropTrack] = useState<string | null>(null);

  const total = projectDuration(project);
  const viewW = Math.max(100, scroll.width - HEADER_W);
  const contentW = Math.max(total + 10, viewW / zoom) * zoom;
  // Janela visível (quantizada em blocos de 512 px) para criar miniaturas só do que aparece na tela.
  const viewFrom = Math.max(0, Math.floor(scroll.left / 512) * 512 - 512);
  const viewTo = Math.ceil((scroll.left + viewW) / 512) * 512 + 512;
  const view = useMemo(() => ({ from: viewFrom, to: viewTo }), [viewFrom, viewTo]);
  const gridPx = rulerStep(zoom).major * zoom;
  const heights = useMemo(() => project.tracks.map((t) => trackHeight(t.kind)), [project.tracks]);
  const lanesH = heights.reduce((a, b) => a + b, 0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setScroll({ left: el.scrollLeft, width: el.clientWidth });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Acompanha a cabeça de reprodução durante a reprodução.
  useEffect(() => {
    if (!playing) return;
    return store.subscribe((s) => {
      const el = scrollerRef.current;
      if (!el) return;
      const x = s.playhead * s.zoom;
      if (x > el.scrollLeft + el.clientWidth - HEADER_W - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
    });
  }, [playing, store]);

  // Ctrl + roda do mouse: zoom ancorado no cursor.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = store.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - HEADER_W;
      const tAtCursor = (el.scrollLeft + cursorX) / s.zoom;
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      s.setZoom(next);
      requestAnimationFrame(() => (el.scrollLeft = Math.max(0, tAtCursor * next - cursorX)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store]);

  const laneRect = () => lanesRef.current!.getBoundingClientRect();
  const timeAtX = (clientX: number) => (clientX - laneRect().left) / store.getState().zoom;

  const trackAtY = useCallback(
    (clientY: number): Track | undefined => {
      const y = clientY - laneRect().top;
      let acc = 0;
      for (let i = 0; i < project.tracks.length; i++) {
        acc += heights[i]!;
        if (y < acc) return project.tracks[i];
      }
      return undefined;
    },
    [project.tracks, heights],
  );

  const snapPoints = (exclude: Set<string>) => {
    const s = store.getState();
    return collectSnapPoints(s.project, { exclude, playhead: s.playhead });
  };

  // ---- Arrasto de clipes ----
  const onClipPointerDown = (e: React.PointerEvent, clip: Clip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = store.getState();
    const track = s.project.tracks.find((t) => t.clips.some((c) => c.id === clip.id))!;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let clickSelect = false;
    if (additive) s.select([clip.id], { additive: true, single: e.altKey });
    else if (!s.selection.includes(clip.id)) s.select([clip.id], { single: e.altKey });
    else clickSelect = true; // clique simples sobre seleção múltipla: refina no pointerup se não houve arrasto
    s.selectTrack(track.id);
    if (track.locked) return;
    const ids = store.getState().selection;
    if (!ids.includes(clip.id)) return;
    drag.current = { kind: 'move', ids, primaryId: clip.id, startX: e.clientX, origStart: clip.start, length: clip.duration, applied: 0, active: false, clickSelect };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onTrimDown = (e: React.PointerEvent, clip: Clip, edge: 'start' | 'end') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const s = store.getState();
    if (!s.selection.includes(clip.id)) s.select([clip.id]);
    drag.current = { kind: 'trim', id: clip.id, edge };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const s = store.getState();
    const pps = s.zoom;
    if (d.kind === 'move') {
      const rawDelta = (e.clientX - d.startX) / pps;
      let start = Math.max(0, d.origStart + rawDelta);
      let snapped: number | null = null;
      if (s.snapping && !e.altKey) {
        const r = snapRange(start, d.length, snapPoints(new Set(d.ids)), SNAP_PX / pps);
        start = r.start;
        snapped = r.snappedTo?.time ?? null;
      }
      const total = start - d.origStart;
      const incremental = total - d.applied;
      const primary = findClip(s.project, d.primaryId);
      const under = trackAtY(e.clientY);
      const changeTrack = d.ids.length === 1 && primary && under && under.id !== primary.track.id && !under.locked ? under.id : undefined;
      if (!d.active && Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD && !changeTrack) return;
      d.active = true;
      if (Math.abs(incremental) > 1e-9 || changeTrack) {
        const ok = s.moveSelection(d.ids, incremental, d.primaryId, changeTrack);
        if (ok) {
          d.applied = total;
          setSnapLine(snapped);
        }
      }
    } else if (d.kind === 'trim') {
      let t = timeAtX(e.clientX);
      if (s.snapping && !e.altKey) {
        const r = snapTime(t, snapPoints(new Set([d.id])), SNAP_PX / pps);
        t = r.time;
        setSnapLine(r.snappedTo?.time ?? null);
      }
      s.trim(d.id, d.edge, Math.max(0, t));
    } else {
      const rect = laneRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const box = { x: Math.min(x, d.x0), y: Math.min(y, d.y0), w: Math.abs(x - d.x0), h: Math.abs(y - d.y0) };
      setMarquee(box);
      const t0 = box.x / pps;
      const t1 = (box.x + box.w) / pps;
      const hit: string[] = [];
      let acc = 0;
      s.project.tracks.forEach((tr, i) => {
        const top = acc;
        acc += heights[i]!;
        if (box.y > acc || box.y + box.h < top) return;
        for (const c of tr.clips) if (c.start < t1 && clipEnd(c) > t0) hit.push(c.id);
      });
      s.select(hit);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    setSnapLine(null);
    setMarquee(null);
    const s = store.getState();
    s.sealDrag();
    if (d?.kind === 'move' && !d.active && d.clickSelect) s.select([d.primaryId]);
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onLanePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-clip-id]')) return;
    const rect = laneRect();
    const s = store.getState();
    if (!e.shiftKey) s.select([]);
    drag.current = { kind: 'marquee', x0: e.clientX - rect.left, y0: e.clientY - rect.top };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ---- Soltar mídia da biblioteca ----
  const onDrop = (e: React.DragEvent, track: Track) => {
    e.preventDefault();
    setDropTrack(null);
    const mediaId = e.dataTransfer.getData('application/x-media-id');
    if (!mediaId) return;
    const item = store.getState().media[mediaId];
    const ok = item && (item.kind === 'audio' ? track.kind === 'audio' : track.kind === 'video');
    if (!ok) return toast.error(item?.kind === 'audio' ? 'Solte áudio em uma faixa de áudio' : 'Solte vídeo e imagens em uma faixa de vídeo');
    store.getState().addToTimeline(mediaId, { at: Math.max(0, timeAtX(e.clientX)), trackId: track.id });
  };

  const scrub = (t: number) => {
    const s = store.getState();
    s.setPlaying(false);
    s.setPlayhead(t);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg" data-testid="timeline">
      <TimelineToolbar />
      <div ref={scrollerRef} className="relative min-h-0 flex-1 overflow-auto" tabIndex={-1}>
        <div className="relative" style={{ width: HEADER_W + contentW, minHeight: RULER_H + lanesH + 24 }}>
          {/* Régua */}
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
            <div className="sticky left-0 z-40 flex shrink-0 items-center border-b border-r border-line bg-panel px-3 text-2xs uppercase tracking-wide text-mute" style={{ width: HEADER_W }}>
              Faixas
            </div>
            <Ruler
              pps={zoom}
              scrollLeft={scroll.left}
              viewportW={viewW}
              width={contentW}
              markers={project.markers}
              onScrub={scrub}
              onScrubEnd={() => store.getState().sealDrag()}
              onMarkerContext={(id) => store.getState().removeMarker(id)}
            />
          </div>

          {/* Faixas */}
          <div className="relative">
            {project.tracks.length === 0 && (
              <div
                className={`sticky left-0 m-4 flex h-32 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-colors ${dropTrack === '__empty' ? 'border-accent bg-accent/10 text-ink' : 'border-line text-mute'}`}
                style={{ width: Math.max(300, scroll.width - 32) }}
                data-testid="timeline-empty"
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-media-id')) {
                    e.preventDefault();
                    setDropTrack('__empty');
                  }
                }}
                onDragLeave={() => setDropTrack(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTrack(null);
                  const id = e.dataTransfer.getData('application/x-media-id');
                  if (id) store.getState().addToTimeline(id, { at: 0 });
                }}
              >
                <Icon name="layers" size={22} />
                <p className="text-xs font-medium text-ink">Arraste uma mídia para começar a editar</p>
                <p className="text-2xs">ou dê dois cliques em um item da biblioteca</p>
              </div>
            )}
            {project.tracks.map((track, i) => (
              <div key={track.id} className="flex" style={{ height: heights[i] }} data-track-id={track.id}>
                <TrackHeader track={track} index={i} selected={selectedTrackId === track.id} height={heights[i]!} />
                <div
                  className={`relative border-b border-line/70 ${dropTrack === track.id ? '!bg-accent/10' : i % 2 ? 'bg-panel/40' : ''}`}
                  style={{ width: contentW, opacity: track.hidden ? 0.5 : 1, backgroundImage: 'linear-gradient(to right, rgb(var(--line) / 0.4) 1px, transparent 1px)', backgroundSize: `${gridPx}px 100%` }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('application/x-media-id')) {
                      e.preventDefault();
                      setDropTrack(track.id);
                    }
                  }}
                  onPointerDown={onLanePointerDown}
                  onDragLeave={() => setDropTrack(null)}
                  onDrop={(e) => onDrop(e, track)}
                >
                  {track.clips.map((c) => (
                    <ClipView
                      key={c.id}
                      clip={c}
                      trackKind={track.kind}
                      trackLocked={track.locked}
                      pps={zoom}
                      selected={selection.includes(c.id)}
                      media={c.type === 'media' ? media[c.mediaId] : undefined}
                      height={heights[i]!}
                      view={view}
                      onPointerDown={onClipPointerDown}
                      onTrimDown={onTrimDown}
                    />
                  ))}
                </div>
              </div>
            ))}
            {/* Referência de coordenadas das faixas e retângulo de seleção (não captura eventos) */}
            <div ref={lanesRef} className="pointer-events-none absolute top-0" style={{ left: HEADER_W, width: contentW, height: Math.max(lanesH, 1) }} data-testid="lanes" aria-hidden="true">
              {marquee && <div className="absolute border border-accent bg-accent/15" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
            </div>
          </div>

          {snapLine !== null && <div className="pointer-events-none absolute z-20 w-px bg-accent" style={{ left: HEADER_W + snapLine * zoom, top: RULER_H, height: lanesH }} />}
          <Playhead zoom={zoom} height={RULER_H + lanesH + 24} />
        </div>
      </div>
    </div>
  );
}

function Playhead({ zoom, height }: { zoom: number; height: number }) {
  const playhead = useEditor((s) => s.playhead);
  const fps = useEditor((s) => s.project.settings.fps);
  return (
    <div className="pointer-events-none absolute top-0 z-30" style={{ left: HEADER_W + playhead * zoom, height }} data-testid="playhead">
      <span className="absolute left-1.5 top-[3px] rounded bg-playhead px-1 font-mono text-[10px] leading-4 text-white shadow">{formatTimecode(playhead, fps).slice(3)}</span>
      <div className="absolute -left-[6px] top-0 h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent border-t-playhead" />
      <div className="h-full w-px bg-playhead" />
    </div>
  );
}

