import { motion, useReducedMotion } from 'framer-motion';
import { Icon, type IconName } from '../../components/Icon';

const TRACKS: Array<{ label: string; color: string; clips: Array<[number, number]> }> = [
  { label: 'Vídeo', color: 'bg-clip-video', clips: [[0, 26], [27, 30], [58, 38]] },
  { label: 'Texto', color: 'bg-clip-text', clips: [[8, 20], [62, 24]] },
  { label: 'Legendas', color: 'bg-clip-caption', clips: [[3, 14], [19, 16], [40, 12], [66, 28]] },
  { label: 'Áudio', color: 'bg-clip-audio', clips: [[0, 96]] },
];

const RAIL: IconName[] = ['film', 'music', 'type', 'wand', 'shuffle', 'zap', 'shapes', 'check'];

/** Ilustração do editor (não interativa) usada no topo da landing: prévia, trilho, propriedades e timeline com cabeça animada. */
export function ProductMock() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-5xl" aria-hidden="true" data-testid="product-mock">
      <div className="hero-glow absolute -inset-x-10 -top-10 bottom-10 -z-10 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-pop">
        {/* barra de título */}
        <div className="flex h-9 items-center gap-2 border-b border-line bg-panel-2 px-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok/80" />
          <span className="mx-auto rounded-md bg-bg px-10 py-0.5 text-[10px] text-mute">Meu primeiro vídeo · Salvo</span>
          <span className="rounded-md bg-accent px-2.5 py-0.5 text-[10px] font-semibold text-accent-ink">Exportar</span>
        </div>

        <div className="flex">
          {/* trilho */}
          <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-line bg-panel py-3 sm:flex">
            {RAIL.map((n, i) => (
              <span key={n} className={`flex h-8 w-8 items-center justify-center rounded-lg ${i === 7 ? 'bg-accent/15 text-accent' : 'text-mute'}`}>
                <Icon name={n} size={15} />
              </span>
            ))}
          </div>

          {/* prévia */}
          <div className="stage-bg flex min-w-0 flex-1 items-center justify-center p-4">
            <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md shadow-stage" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 52%, #f97316 100%)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/35 p-3 text-white backdrop-blur">
                  <Icon name="play" size={22} />
                </span>
              </div>
              <span className="absolute inset-x-6 bottom-5 rounded bg-black/55 px-2 py-1 text-center text-[11px] font-semibold text-white">Legendas com a palavra falada em destaque</span>
              <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] text-white">00:00:08:12</span>
            </div>
          </div>

          {/* propriedades */}
          <div className="hidden w-52 shrink-0 border-l border-line bg-panel p-3 lg:block">
            <p className="mb-2 text-[11px] font-semibold">Revisão</p>
            <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 p-2">
              <svg width="42" height="42" viewBox="0 0 52 52" className="text-ok">
                <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="5" />
                <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="130 138" transform="rotate(-90 26 26)" />
                <text x="26" y="30" textAnchor="middle" className="fill-current text-[14px] font-bold">
                  94
                </text>
              </svg>
              <div>
                <p className="text-[11px] font-semibold">Qualidade</p>
                <p className="text-[10px] text-mute">Ótimo</p>
              </div>
            </div>
            {['Escala', 'Opacidade', 'Volume'].map((l, i) => (
              <div key={l} className="mb-2.5">
                <div className="mb-1 flex justify-between text-[10px] text-mute">
                  <span>{l}</span>
                  <span>{[100, 85, 70][i]}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-panel-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: [100, 85, 70][i] + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* timeline */}
        <div className="relative border-t border-line bg-bg px-3 py-2.5">
          <div className="space-y-1.5">
            {TRACKS.map((t) => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[9px] font-medium text-mute">{t.label}</span>
                <div className="relative h-5 flex-1 rounded bg-panel-2/70">
                  {t.clips.map(([start, width], i) => (
                    <span key={i} className={`absolute top-0.5 h-4 rounded ${t.color} opacity-90`} style={{ left: start + '%', width: width + '%' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-2 left-[60px] right-3">
            <motion.div className="absolute inset-y-0 w-px bg-playhead" initial={{ left: '8%' }} animate={reduce ? { left: '38%' } : { left: ['8%', '92%'] }} transition={reduce ? undefined : { duration: 9, repeat: Infinity, ease: 'linear' }}>
              <span className="absolute -left-[5px] -top-1 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-playhead" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* cartões flutuantes */}
      <motion.div className="absolute -left-4 -top-6 hidden rounded-xl border border-line bg-panel p-3 shadow-pop md:block" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <p className="text-[10px] font-semibold text-mute">Zonas seguras</p>
        <p className="text-xs font-semibold">Reels · Shorts · TikTok</p>
      </motion.div>
      <motion.div className="absolute -right-3 bottom-28 hidden rounded-xl border border-line bg-panel p-3 shadow-pop md:block" animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <p className="mb-1.5 text-[10px] font-semibold text-mute">Exportando MP4…</p>
        <div className="h-1.5 w-32 rounded-full bg-panel-3">
          <div className="h-full w-[72%] rounded-full bg-accent" />
        </div>
      </motion.div>
    </div>
  );
}
