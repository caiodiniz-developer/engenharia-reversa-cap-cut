import { clipEnd, evaluateKeyframes, projectDuration, type MediaClip, type Project, type Track } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from '../store/editor';
import { composeFrame, type FrameSource } from './compose';

const PRELOAD_AHEAD = 1.5;
const MAX_POOL = 10;
const MAX_PREVIEW_WIDTH = 960;

type Media = HTMLVideoElement | HTMLAudioElement;

interface Slot {
  el: Media | HTMLImageElement;
  kind: 'video' | 'audio' | 'image';
  mediaId: string;
  lastUsed: number;
  /** Nó de áudio já conectado (createMediaElementSource só pode ser chamado uma vez por elemento). */
  chain?: { gain: GainNode; bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode; pan: StereoPannerNode };
}

/**
 * Motor de reprodução do navegador: relógio, elementos <video>/<audio> sincronizados com a timeline,
 * mixagem com Web Audio e composição em Canvas. Os elementos são "escravos" do relógio.
 * Limitações conhecidas (documentadas no README): reprodução reversa no preview é por quadros
 * (sem áudio); redução de ruído e normalização só entram na exportação.
 */
export class PlayerEngine {
  private ctx2d: CanvasRenderingContext2D;
  private slots = new Map<string, Slot>();
  private audio?: AudioContext;
  private master?: GainNode;
  private raf = 0;
  private wallStart = 0;
  private timeStart = 0;
  private wasPlaying = false;
  private disposed = false;
  private unsub: () => void;
  private lastKey = '';

  constructor(
    public readonly canvas: HTMLCanvasElement,
    private getMedia: (id: string) => MediaItem | undefined,
  ) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D indisponível');
    this.ctx2d = c;
    this.unsub = useEditor.subscribe(() => this.invalidate());
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsub();
    for (const s of this.slots.values()) this.release(s);
    this.slots.clear();
    void this.audio?.close();
  }

  /** Fluxo de vídeo (canvas) + áudio (mixagem) para a gravação local. `stop` desconecta o destino de áudio. */
  captureStream(fps: number): { stream: MediaStream; stop: () => void } {
    this.ensureAudio();
    void this.audio?.resume();
    const tracks = [...this.canvas.captureStream(fps).getVideoTracks()];
    let dest: MediaStreamAudioDestinationNode | undefined;
    if (this.audio && this.master) {
      dest = this.audio.createMediaStreamDestination();
      this.master.connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
    }
    return {
      stream: new MediaStream(tracks),
      stop: () => {
        if (dest) this.master?.disconnect(dest);
        tracks.forEach((t) => t.stop());
      },
    };
  }

  /** Força um redesenho no próximo quadro (ex.: propriedade alterada com o vídeo pausado). */
  invalidate(): void {
    this.lastKey = '';
  }

  private size(project: Project): { w: number; h: number } {
    const { width, height } = project.settings;
    const scale = Math.min(1, MAX_PREVIEW_WIDTH / width);
    return { w: Math.max(2, Math.round(width * scale)), h: Math.max(2, Math.round(height * scale)) };
  }

  private ensureAudio(): void {
    if (this.audio || typeof AudioContext === 'undefined') return;
    this.audio = new AudioContext();
    this.master = this.audio.createGain();
    this.master.connect(this.audio.destination);
  }

  private slotFor(clip: MediaClip): Slot | undefined {
    const item = this.getMedia(clip.mediaId);
    if (!item) return undefined;
    const existing = this.slots.get(clip.id);
    if (existing) {
      existing.lastUsed = performance.now();
      return existing;
    }
    const url = item.kind === 'video' ? (item.urls.proxy ?? item.urls.original) : item.urls.original;
    let el: Slot['el'];
    if (item.kind === 'image') {
      el = new Image();
      el.crossOrigin = 'anonymous';
      el.src = url;
    } else {
      const m = document.createElement(item.kind === 'audio' ? 'audio' : 'video') as Media;
      m.crossOrigin = 'anonymous';
      m.preload = 'auto';
      m.src = url;
      (m as HTMLVideoElement).playsInline = true;
      el = m;
    }
    const slot: Slot = { el, kind: item.kind, mediaId: item.id, lastUsed: performance.now() };
    this.slots.set(clip.id, slot);
    this.evict();
    return slot;
  }

  private release(s: Slot): void {
    if (s.el instanceof HTMLMediaElement) {
      s.el.pause();
      s.el.removeAttribute('src');
      s.el.load();
    }
    s.chain?.gain.disconnect();
  }

  private evict(): void {
    if (this.slots.size <= MAX_POOL) return;
    const sorted = [...this.slots.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id, s] of sorted.slice(0, this.slots.size - MAX_POOL)) {
      this.release(s);
      this.slots.delete(id);
    }
  }

  private connect(slot: Slot): NonNullable<Slot['chain']> | undefined {
    if (slot.chain) return slot.chain;
    if (!(slot.el instanceof HTMLMediaElement) || !this.audio || !this.master) return undefined;
    const a = this.audio;
    const src = a.createMediaElementSource(slot.el);
    const bass = a.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 100;
    const mid = a.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    const treble = a.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 8000;
    const pan = a.createStereoPanner();
    const gain = a.createGain();
    src.connect(bass).connect(mid).connect(treble).connect(pan).connect(gain).connect(this.master);
    slot.chain = { gain, bass, mid, treble, pan };
    return slot.chain;
  }

  /** Fades de áudio efetivos, incluindo o crossfade criado por transições (igual à exportação). */
  private fades(track: Track, clip: MediaClip): { fadeIn: number; fadeOut: number } {
    let fadeIn = clip.audio.fadeIn;
    let fadeOut = clip.audio.fadeOut;
    if (clip.transitionIn) {
      const prev = track.clips.filter((c) => c.id !== clip.id && c.start < clip.start).sort((a, b) => clipEnd(b) - clipEnd(a))[0];
      const overlap = prev ? Math.max(0, clipEnd(prev) - clip.start) : 0;
      fadeIn = Math.max(fadeIn, clip.transitionIn.duration, overlap);
    }
    const next = track.clips.find((c) => c.type === 'media' && c.id !== clip.id && c.transitionIn && c.start < clipEnd(clip) && c.start > clip.start);
    if (next) fadeOut = Math.max(fadeOut, clipEnd(clip) - next.start);
    return { fadeIn, fadeOut };
  }

  private syncClip(slot: Slot, clip: MediaClip, track: Track, t: number, playing: boolean, fps: number, audible: boolean): void {
    const item = this.getMedia(clip.mediaId);
    if (!item) return;
    const el = slot.el;
    if (!(el instanceof HTMLMediaElement)) return;
    const local = t - clip.start;
    let desired = clip.freeze ? clip.sourceIn : clip.reverse ? clip.sourceIn + (clip.duration - local) * clip.speed : clip.sourceIn + local * clip.speed;
    desired = Math.max(0, Math.min(desired, Math.max(0, item.duration - 0.02)));
    const stepped = clip.freeze || clip.reverse;

    if (stepped || !playing) {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - desired) > 0.5 / fps) el.currentTime = desired;
    } else {
      el.playbackRate = Math.max(0.0625, Math.min(16, clip.speed));
      if (Math.abs(el.currentTime - desired) > 0.3 && !el.seeking) el.currentTime = desired;
      if (el.paused) void el.play().catch(() => {});
    }

    const chain = this.connect(slot);
    if (!chain || !this.audio) return;
    const a = clip.audio;
    const k = clip.keyframes.volume;
    let g = evaluateKeyframes(k, local, a.volume);
    const f = this.fades(track, clip);
    if (f.fadeIn > 0 && local < f.fadeIn) g *= Math.max(0, local / f.fadeIn);
    const rem = clip.duration - local;
    if (f.fadeOut > 0 && rem < f.fadeOut) g *= Math.max(0, rem / f.fadeOut);
    const silent = !audible || a.muted || track.muted || clip.freeze || clip.reverse || (item.kind === 'video' && !item.hasAudio);
    chain.gain.gain.value = silent ? 0 : g;
    chain.bass.gain.value = a.eq.bass;
    chain.mid.gain.value = a.eq.mid;
    chain.treble.gain.value = a.eq.treble;
    chain.pan.pan.value = a.pan;
  }

  private loop(): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const st = useEditor.getState();
    const project = st.project;
    const total = projectDuration(project);
    const { w, h } = this.size(project);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.invalidate();
    }

    if (st.playing && !this.wasPlaying) {
      this.ensureAudio();
      void this.audio?.resume();
      this.wallStart = performance.now();
      this.timeStart = st.playhead;
    }
    this.wasPlaying = st.playing;

    let t = st.playhead;
    if (st.playing) {
      t = this.timeStart + (performance.now() - this.wallStart) / 1000;
      if (t >= total) {
        if (st.loop && total > 0) {
          t = 0;
          this.wallStart = performance.now();
          this.timeStart = 0;
        } else {
          t = total;
          useEditor.setState({ playing: false, playhead: total });
        }
      }
      if (t !== st.playhead) useEditor.setState({ playhead: t });
    }

    if (this.master && this.audio) this.master.gain.value = st.muted ? 0 : st.volume;

    // Prepara elementos dos clipes ativos e dos que começam em breve.
    const fps = project.settings.fps;
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.type !== 'media') continue;
        const active = t >= clip.start - 1e-9 && t < clipEnd(clip) - 1e-9;
        const soon = !active && clip.start > t && clip.start - t < PRELOAD_AHEAD;
        if (!active && !soon) {
          const s = this.slots.get(clip.id);
          if (s?.el instanceof HTMLMediaElement && !s.el.paused) s.el.pause();
          continue;
        }
        const slot = this.slotFor(clip);
        if (!slot) continue;
        if (soon) {
          if (slot.el instanceof HTMLMediaElement && !slot.el.seeking && Math.abs(slot.el.currentTime - clip.sourceIn) > 0.1) slot.el.currentTime = clip.sourceIn;
          continue;
        }
        this.syncClip(slot, clip, track, t, st.playing, fps, true);
      }
    }

    // Redesenha quando algo mudou ou enquanto toca (vídeo tem novo quadro a todo instante).
    const key = st.playing ? '' : `${t.toFixed(4)}|${st.history.index}|${st.history.entries.length}|${w}x${h}|${this.seekSig()}`;
    if (st.playing || key !== this.lastKey) {
      this.lastKey = key;
      composeFrame(this.ctx2d, {
        project,
        time: t,
        width: w,
        height: h,
        source: (clip): FrameSource | undefined => {
          const s = this.slots.get(clip.id);
          if (!s) return undefined;
          const el = s.el;
          if (el instanceof HTMLVideoElement && el.readyState < 2) return undefined;
          if (el instanceof HTMLImageElement && !el.complete) return undefined;
          return { video: el as FrameSource['video'] };
        },
      });
    }
  }

  /** Assinatura dos estados de seek: quando um seek termina, o quadro novo precisa ser desenhado. */
  private seekSig(): string {
    let sig = '';
    for (const s of this.slots.values()) if (s.el instanceof HTMLMediaElement) sig += s.el.seeking ? 's' : s.el.readyState >= 2 ? 'r' : 'n';
    return sig;
  }
}
