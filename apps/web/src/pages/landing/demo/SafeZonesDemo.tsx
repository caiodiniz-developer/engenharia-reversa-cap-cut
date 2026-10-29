import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { getPlatform } from '@editor/core';
import { captionVerdict, suggestedCaptionY } from './safeDemo';

const CHOICES = ['shorts', 'reels', 'tiktok', 'stories'] as const;

/** Telefone com as zonas cobertas pela interface (valores reais de `PLATFORMS`) e uma legenda que você move com o controle. */
export function SafeZonesDemo() {
  const reduce = useReducedMotion();
  const [id, setId] = useState<(typeof CHOICES)[number]>('tiktok');
  const [y, setY] = useState(0.4);
  const platform = getPlatform(id)!;
  const verdict = captionVerdict(id, y);
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 150, damping: 20 };
  const s = platform.safe;

  return (
    <div className="grid items-center gap-8 md:grid-cols-[260px_1fr]" data-testid="demo-safe">
      <div className="mx-auto w-[220px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-[6px] border-panel-3 shadow-pop" style={{ background: 'linear-gradient(160deg, #0ea5e9 0%, #7c3aed 55%, #f97316 100%)' }} data-testid="demo-phone">
          <motion.div className="absolute inset-x-0 top-0 bg-red-500/35" initial={false} animate={{ height: s.top * 100 + '%' }} transition={spring} />
          <motion.div className="absolute inset-x-0 bottom-0 bg-red-500/35" initial={false} animate={{ height: s.bottom * 100 + '%' }} transition={spring} />
          <motion.div className="absolute left-0 bg-red-500/35" initial={false} animate={{ top: s.top * 100 + '%', bottom: s.bottom * 100 + '%', width: s.left * 100 + '%' }} transition={spring} />
          <motion.div className="absolute right-0 bg-red-500/35" initial={false} animate={{ top: s.top * 100 + '%', bottom: s.bottom * 100 + '%', width: s.right * 100 + '%' }} transition={spring} />
          <motion.span
            className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold text-white shadow ${verdict.inside ? 'bg-ok' : 'bg-danger'}`}
            initial={false}
            animate={{ top: (0.5 + y) * 100 + '%' }}
            transition={spring}
            data-testid="demo-caption"
            data-inside={verdict.inside}
          >
            Sua legenda aqui
          </motion.span>
          <span className="absolute bottom-2 right-2 text-[9px] font-semibold text-white/80">{platform.label}</span>
        </div>
      </div>

      <div>
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Plataforma">
          {CHOICES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={id === c} onClick={() => setId(c)} className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${id === c ? 'border-accent bg-accent/15 text-accent' : 'border-line text-mute hover:text-ink'}`}>
              {getPlatform(c)!.label}
            </button>
          ))}
        </div>
        <label className="label" htmlFor="demo-y">
          Posição vertical da legenda
        </label>
        <input id="demo-y" type="range" min={-0.45} max={0.48} step={0.01} value={y} onChange={(e) => setY(Number(e.target.value))} className="mb-4 w-full" data-testid="demo-y" />
        <p className={`mb-4 flex items-center gap-2 text-sm font-medium ${verdict.inside ? 'text-ok' : 'text-danger'}`} role="status" data-testid="demo-verdict">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${verdict.inside ? 'bg-ok' : 'bg-danger'}`} />
          {verdict.inside ? 'Dentro da zona segura: o texto fica visível.' : `Coberta pela interface do aplicativo (passa ${Math.round(verdict.overflow * 100)}% do quadro da área livre).`}
        </p>
        <button type="button" className="btn" onClick={() => setY(suggestedCaptionY(id))} data-testid="demo-suggest">
          Usar a posição mais baixa que ainda é segura
        </button>
        <p className="mt-4 text-xs leading-relaxed text-mute">As áreas em vermelho são aproximações do que a interface de cada plataforma costuma cobrir (botões, nome do perfil, descrição). No editor, o mesmo desenho aparece sobre o seu preview.</p>
      </div>
    </div>
  );
}
