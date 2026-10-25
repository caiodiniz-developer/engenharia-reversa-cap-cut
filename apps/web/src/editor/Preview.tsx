import { useEffect, useRef, useState } from 'react';
import { formatTimecode } from '@editor/core';
import { Icon } from '../components/Icon';
import { PlayerEngine } from '../engine/player';
import { getEngine, setEngine } from '../engine/registry';
import { aspectLabel } from '../lib/format';
import { selectDuration, useEditor } from '../store/editor';
import { toast } from '../store/toasts';

function Timecode() {
  const playhead = useEditor((s) => s.playhead);
  const fps = useEditor((s) => s.project.settings.fps);
  const duration = useEditor(selectDuration);
  return (
    <div className="tnum font-mono text-[15px] leading-none" aria-label="Posição atual" data-testid="timecode">
      <span className="text-ink">{formatTimecode(playhead, fps)}</span>
      <span className="text-mute"> / {formatTimecode(duration, fps)}</span>
    </div>
  );
}

/** Salva o quadro atual do preview como PNG (resolução do preview, no máximo 960 px de largura). */
function saveFrame() {
  const canvas = getEngine()?.canvas;
  if (!canvas) return;
  const s = useEditor.getState();
  const stamp = formatTimecode(s.playhead, s.project.settings.fps).replace(/:/g, '-');
  canvas.toBlob((blob) => {
    if (!blob) return toast.error('Não foi possível capturar o quadro');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'quadro'}-${stamp}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast.success('Quadro salvo como PNG');
  }, 'image/png');
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const settings = useEditor((s) => s.project.settings);
  const empty = useEditor((s) => s.project.tracks.every((t) => t.clips.length === 0));
  const playing = useEditor((s) => s.playing);
  const volume = useEditor((s) => s.volume);
  const muted = useEditor((s) => s.muted);
  const loop = useEditor((s) => s.loop);
  const guides = useEditor((s) => s.guides);
  const st = useEditor.getState();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new PlayerEngine(canvas, (id) => useEditor.getState().media[id]);
    setEngine(engine);
    return () => {
      setEngine(null);
      engine.dispose();
    };
  }, []);

  // Ajusta o quadro ao espaço disponível mantendo a proporção do projeto.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      const pad = 36;
      const ar = settings.width / settings.height;
      const w = Math.max(40, Math.min(cw - pad * 2, (ch - pad * 2) * ar));
      setFit({ w, h: w / ar });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.width, settings.height]);

  const goFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };

  const duration = () => selectDuration(useEditor.getState());

  return (
    <div ref={wrapRef} className="flex h-full min-h-0 flex-col bg-bg" data-testid="preview">
      <div ref={boxRef} className="stage-bg relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          <span className="chip bg-panel/80 backdrop-blur" title="Formato do projeto">
            <Icon name="film" size={11} /> {settings.width}×{settings.height} · {settings.fps} fps · {aspectLabel(settings.width, settings.height)}
          </span>
        </div>
        <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-panel/80 p-0.5 backdrop-blur">
          <button type="button" className="btn-icon" aria-label="Guias de composição" aria-pressed={guides} title="Guias de composição" onClick={st.toggleGuides}>
            <Icon name="grid" />
          </button>
          <button type="button" className="btn-icon" aria-label="Salvar quadro atual (PNG)" title="Salvar quadro atual como PNG" onClick={saveFrame} data-testid="save-frame">
            <Icon name="camera" />
          </button>
          <button type="button" className="btn-icon" aria-label="Tela cheia" title="Tela cheia" onClick={goFullscreen}>
            <Icon name="fullscreen" />
          </button>
        </div>

        <div className="relative rounded-sm shadow-stage" style={{ width: fit.w, height: fit.h }}>
          <canvas ref={canvasRef} className="block h-full w-full rounded-sm bg-black" onClick={() => st.togglePlay()} data-testid="preview-canvas" aria-label="Pré-visualização do vídeo" />
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-white/70" data-testid="preview-empty">
              <Icon name="film" size={30} />
              <p className="text-sm font-medium">Seu vídeo aparece aqui</p>
              <p className="max-w-[260px] text-2xs text-white/50">Importe mídias na aba Mídia e dê dois cliques para adicioná-las à timeline.</p>
            </div>
          )}
          {guides && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-testid="guides">
              <g stroke="rgba(255,255,255,.5)" strokeWidth="0.25" vectorEffect="non-scaling-stroke" fill="none">
                <path d="M33.33 0V100M66.66 0V100M0 33.33H100M0 66.66H100" />
                <path d="M50 46V54M46 50H54" />
                <rect x="5" y="5" width="90" height="90" strokeDasharray="1.5 1.5" />
                <rect x="10" y="10" width="80" height="80" strokeDasharray="1.5 1.5" />
              </g>
            </svg>
          )}
        </div>
      </div>

      <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-panel px-4">
        <Timecode />
        <div className="flex items-center gap-1">
          <button type="button" className="btn-icon" aria-label="Início" title="Início (Home)" onClick={() => { st.setPlaying(false); st.setPlayhead(0); }}>
            <Icon name="skipBack" />
          </button>
          <button type="button" className="btn-icon" aria-label="Quadro anterior" title="Quadro anterior (←)" onClick={() => st.stepFrames(-1)}>
            <Icon name="stepBack" />
          </button>
          <button type="button" className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md transition-transform hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={playing ? 'Pausar' : 'Reproduzir'} title="Reproduzir/Pausar (Espaço)" onClick={() => st.togglePlay()} data-testid="play-button">
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <button type="button" className="btn-icon" aria-label="Próximo quadro" title="Próximo quadro (→)" onClick={() => st.stepFrames(1)}>
            <Icon name="stepForward" />
          </button>
          <button type="button" className="btn-icon" aria-label="Fim" title="Fim (End)" onClick={() => { st.setPlaying(false); st.setPlayhead(duration()); }}>
            <Icon name="skipForward" />
          </button>
          <button type="button" className="btn-icon" aria-label="Repetir" aria-pressed={loop} title="Repetir" onClick={st.toggleLoop}>
            <Icon name="repeat" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" className="btn-icon" aria-label={muted ? 'Ativar som' : 'Silenciar'} onClick={st.toggleMute}>
            <Icon name={muted || volume === 0 ? 'volumeOff' : 'volume'} />
          </button>
          <input type="range" className="w-24" min={0} max={1} step={0.01} value={muted ? 0 : volume} style={{ '--p': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties} onChange={(e) => st.setVolume(Number(e.target.value))} aria-label="Volume" />
        </div>
      </div>
    </div>
  );
}
