import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { searchDemo, typewriterFrame } from './paletteModel';

const SAMPLES = ['dividir', 'exportar', 'velocidade', 'tema', 'marcador'];

/**
 * A paleta de comandos (Ctrl+K) do editor, aqui com a mesma lista e a mesma busca. Digita sozinha até você
 * clicar na caixa; depois é só digitar o que quiser (a busca ignora acentos).
 */
export function PaletteDemo() {
  const reduce = useReducedMotion();
  const [own, setOwn] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce || own !== null) return;
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, [reduce, own]);

  const query = own ?? (reduce ? SAMPLES[0]! : typewriterFrame(SAMPLES, tick));
  const results = searchDemo(query);

  return (
    <div className="mx-auto max-w-2xl" data-testid="demo-palette">
      <div className="mb-3 flex items-center gap-2 text-xs text-mute">
        <span className="kbd">Ctrl</span>
        <span className="kbd">K</span>
        <span>abre a paleta em qualquer tela do editor</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={16} className="text-mute" />
          <input
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-mute/70"
            placeholder="Digite um comando… (ex.: dividir, exportar, tema)"
            aria-label="Buscar comandos (demonstração)"
            value={query}
            onFocus={() => own === null && setOwn(query)}
            onChange={(e) => setOwn(e.target.value)}
            data-testid="demo-palette-input"
          />
          {own === null && !reduce && <span className="h-4 w-0.5 animate-pulse bg-accent" aria-hidden="true" />}
          <span className="kbd">Esc</span>
        </div>
        <ul className="min-h-[300px] p-1.5" aria-label="Resultados" data-testid="demo-palette-results">
          <AnimatePresence initial={false} mode="popLayout">
            {results.map((c, i) => (
              <motion.li key={c.id} layout={!reduce} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: 8 }} transition={{ duration: 0.15 }} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs ${i === 0 ? 'bg-accent/15' : ''}`} data-testid="demo-palette-item" data-id={c.id}>
                <Icon name={c.icon} size={15} className={i === 0 ? 'text-accent' : 'text-mute'} />
                <span className="flex-1 truncate">{c.label}</span>
                <span className="text-2xs text-mute">{c.group}</span>
                {c.shortcut && <span className="kbd">{c.shortcut}</span>}
              </motion.li>
            ))}
          </AnimatePresence>
          {results.length === 0 && (
            <li className="px-4 py-10 text-center text-xs text-mute" data-testid="demo-palette-empty">
              Nenhum comando encontrado para “{query}”.
            </li>
          )}
        </ul>
      </div>
      <p className="mt-4 text-center text-xs text-mute">São comandos reais do editor: no projeto eles executam a ação (dividir, exportar, aplicar efeitos e muito mais).</p>
    </div>
  );
}
