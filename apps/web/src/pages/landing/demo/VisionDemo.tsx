import { useState } from 'react';
import { simulateHex, VISION_LABEL, VISION_MODES } from '../../../lib/vision';
import type { VisionMode } from '../../../store/editor';
import { confusedPairs, SWATCHES } from './visionDemo';

/** Como as mesmas cores aparecem para quem tem daltonismo; avisa quais pares deixam de se distinguir. */
export function VisionDemo() {
  const [mode, setMode] = useState<VisionMode>('normal');
  const pairs = confusedPairs(mode);
  return (
    <div data-testid="demo-vision">
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Tipo de visão">
        {VISION_MODES.map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${mode === m ? 'border-accent bg-accent/15 text-accent' : 'border-line text-mute hover:text-ink'}`}>
            {VISION_LABEL[m]}
          </button>
        ))}
      </div>

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SWATCHES.map((s) => {
          const shown = simulateHex(s.hex, mode);
          return (
            <li key={s.name} className="overflow-hidden rounded-xl border border-line bg-panel">
              <div className="h-20 transition-colors duration-500" style={{ background: shown }} data-testid="demo-swatch" data-shown={shown} />
              <div className="px-3 py-2">
                <p className="text-xs font-semibold">{s.name}</p>
                <p className="font-mono text-[10px] text-mute">{shown}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-line bg-panel p-4" role="status" data-testid="demo-vision-verdict">
        {mode === 'normal' ? (
          <p className="text-sm text-mute">Escolha um tipo de visão para ver como esta paleta aparece e quais cores deixam de se distinguir.</p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-ok">Neste tipo de visão todas as cores continuam fáceis de distinguir.</p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-amber-400">Difíceis de distinguir lado a lado:</p>
            <ul className="flex flex-wrap gap-2">
              {pairs.map((p) => (
                <li key={p.a + p.b} className="rounded-full border border-line bg-bg px-3 py-1 text-xs" data-testid="demo-confused">
                  {p.a} × {p.b}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-mute">Simulação aproximada por matrizes de cor (Machado et al., 2009). No editor, o mesmo filtro pode ser ligado sobre o preview, sem alterar a exportação.</p>
    </div>
  );
}
