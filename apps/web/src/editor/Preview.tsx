import { useEffect, useRef, useState } from 'react';
import { formatTimecode } from '@editor/core';
import { Icon } from '../components/Icon';
import { PlayerEngine } from '../engine/player';
import { setEngine } from '../engine/registry';
import { aspectLabel } from '../lib/format';
import { selectDuration, useEditor } from '../store/editor';

function Timecode() {
  const playhead = useEditor((s) => s.playhead);
  const fps = useEditor((s) => s.project.settings.fps);
  const duration = useEditor(selectDuration);
  return (
    <div className="font-mono text-xs tabular-nums" aria-label="Posição atual" data-testid="timecode">
      <span className="text-ink">{formatTimecode(playhead, fps)}</span>
      <span className="text-mute"> / {formatTimecode(duration, fps)}</span>
    </div>
  );
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const settings = useEditor((s) => s.project.settings);
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
      const ar = settings.width / settings.height;
      const w = Math.max(40, Math.min(cw - 16, (ch - 16) * ar));
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
      <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="relative shadow-2xl ring-1 ring-line" style={{ width: fit.w, height: fit.h }}>
          <canvas ref={canvasRef} className="block h-full w-full bg-black" onClick={() => st.togglePlay()} data-testid="preview-canvas" aria-label="Pré-visualização do vídeo" />
          {guides && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-testid="guides">
              <g stroke="rgba(255,255,255,.45)" strokeWidth="0.25" vectorEffect="non-scaling-stroke" fill="none">
                <path d="M33.33 0V100M66.66 0V100M0 33.33H100M0 66.66H100" />
                <path d="M50 46V54M46 50H54" />
                <rect x="5" y="5" width="90" height="90" strokeDasharray="1.5 1.5" />
                <rect x="10" y="10" width="80" height="80" strokeDasharray="1.5 1.5" />
              </g>
            </svg>
          )}
        </div>
      </div>

      <div className="flex h-11 shrink-0 items-center gap-1 border-t border-line bg-panel px-3">
        <Timecode />
        <div className="mx-auto flex items-center gap-1">
          <button type="button" className="btn-icon" aria-label="Início" title="Início (Home)" onClick={() => { st.setPlaying(false); st.setPlayhead(0); }}>
            <Icon name="skipBack" />
          </button>
          <button type="button" className="btn-icon" aria-label="Quadro anterior" title="Quadro anterior (←)" onClick={() => st.stepFrames(-1)}>
            <Icon name="stepBack" />
          </button>
          <button type="button" className="btn-icon !h-9 !w-9 rounded-full bg-accent text-bg hover:!bg-accent/90 hover:!text-bg" aria-label={playing ? 'Pausar' : 'Reproduzir'} title="Reproduzir/Pausar (Espaço)" onClick={() => st.togglePlay()} data-testid="play-button">
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
        <div className="flex items-center gap-1">
          <span className="mr-1 rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-mute" title="Proporção do projeto">
            {aspectLabel(settings.width, settings.height)}
          </span>
          <button type="button" className="btn-icon" aria-label={muted ? 'Ativar som' : 'Silenciar'} onClick={st.toggleMute}>
            <Icon name={muted || volume === 0 ? 'volumeOff' : 'volume'} />
          </button>
          <input type="range" className="w-16" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(e) => st.setVolume(Number(e.target.value))} aria-label="Volume" />
          <button type="button" className="btn-icon" aria-label="Guias de composição" aria-pressed={guides} title="Guias de composição" onClick={st.toggleGuides}>
            <Icon name="grid" />
          </button>
          <button type="button" className="btn-icon" aria-label="Tela cheia" title="Tela cheia" onClick={goFullscreen}>
            <Icon name="fullscreen" />
          </button>
        </div>
      </div>
    </div>
  );
}
