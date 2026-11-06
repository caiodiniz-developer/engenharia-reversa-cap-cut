import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../../components/Icon';
import { SHORTCUTS } from '../../editor/shortcuts';
import { groupShortcuts, splitKeyCombos } from '../../editor/shortcutGroups';

/** Todos os atalhos do editor por categoria, com busca sem acento. Os dados são os mesmos da tela de ajuda do editor. */
export function ShortcutsSection() {
  const [query, setQuery] = useState('');
  const reduce = useReducedMotion();
  const groups = useMemo(() => groupShortcuts(SHORTCUTS, query), [query]);
  const found = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div data-testid="shortcuts">
      <div className="mx-auto mb-8 flex max-w-md items-center gap-2 rounded-xl border border-line bg-panel px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <Icon name="search" size={15} className="text-mute" />
        <input className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-mute/70" placeholder="Buscar atalho (ex.: dividir, zoom, marcador)" aria-label="Buscar atalho" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="shortcuts-search" />
        <span className="text-2xs text-mute" aria-live="polite" data-testid="shortcuts-count">
          {found} {found === 1 ? 'atalho' : 'atalhos'}
        </span>
      </div>
      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-mute" data-testid="shortcuts-empty">
          Nenhum atalho encontrado para “{query}”.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <motion.section
              key={g.category}
              {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-40px' }, transition: { duration: 0.4, delay: i * 0.05 } })}
              className="glass rounded-2xl p-5"
              aria-label={g.category}
              data-testid="shortcut-group"
            >
              <h3 className="mb-3 text-[13px] font-semibold">{g.category}</h3>
              <ul className="space-y-2.5">
                {g.items.map((s) => (
                  <li key={s.keys} className="flex items-start justify-between gap-3 text-[13px] leading-snug">
                    <span className="text-mute">{s.label}</span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {splitKeyCombos(s.keys).map((combo) => (
                        <span key={combo} className="kbd whitespace-nowrap">
                          {combo}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>
      )}
      <p className="mt-6 text-center text-xs text-mute">
        Esqueceu um atalho? No editor, <span className="kbd">Ctrl + K</span> abre a paleta com todos os comandos e <span className="kbd">?</span> mostra esta lista.
      </p>
    </div>
  );
}
