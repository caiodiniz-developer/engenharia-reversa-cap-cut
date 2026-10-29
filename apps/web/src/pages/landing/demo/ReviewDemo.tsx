import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { RULE_TITLE, projectDuration } from '@editor/core';
import { Icon } from '../../../components/Icon';
import { useCountUp } from '../anim';
import { buildReviewDemo, demoAction, reviewDemoState } from './reviewModel';

const TRACK_COLOR = { video: 'bg-clip-video', caption: 'bg-clip-caption', text: 'bg-clip-text', audio: 'bg-clip-audio' } as const;

/** Revisão ao vivo: o projeto é real (montado com o core do editor), os problemas vêm da mesma função e as correções são as mesmas operações. */
export function ReviewDemo() {
  const reduce = useReducedMotion();
  const [project, setProject] = useState(buildReviewDemo);
  const { issues, score } = useMemo(() => reviewDemoState(project), [project]);
  const shown = useCountUp(score, true, 700);
  const total = Math.max(15, projectDuration(project) + 1);
  const tone = score >= 90 ? 'text-ok' : score >= 70 ? 'text-amber-400' : 'text-danger';

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-testid="demo-review">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-mute">Timeline do projeto de exemplo</p>
        <div className="space-y-2 rounded-2xl border border-line bg-bg p-4">
          {project.tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className={`w-20 shrink-0 truncate text-[11px] font-medium ${t.hidden ? 'text-mute line-through' : 'text-mute'}`}>{t.name}</span>
              <div className="relative h-7 flex-1 rounded-md bg-panel-2">
                {t.clips.map((c) => (
                  <motion.span
                    key={c.id}
                    className={`absolute top-0.5 h-6 rounded ${TRACK_COLOR[t.kind]} ${t.hidden ? 'opacity-35' : 'opacity-90'}`}
                    initial={false}
                    animate={{ left: (c.start / total) * 100 + '%', width: (c.duration / total) * 100 + '%' }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 22 }}
                    data-testid="demo-clip"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-panel p-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-current text-xl font-bold ${tone}`} role="img" aria-label={`Nota ${score} de 100`}>
            <span data-testid="demo-score" data-value={score}>
              {shown}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">Nota de qualidade</p>
            <p className="text-xs text-mute">{issues.length === 0 ? 'Nenhum problema encontrado.' : `${issues.length} ${issues.length === 1 ? 'ponto para resolver' : 'pontos para resolver'}.`}</p>
          </div>
          <button type="button" className="btn ml-auto !h-8 px-3 text-xs" onClick={() => setProject(buildReviewDemo())} data-testid="demo-reset">
            Reiniciar
          </button>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-mute">Verificações</p>
        <ul className="space-y-2" data-testid="demo-issues">
          <AnimatePresence initial={false}>
            {issues.map((i) => {
              const action = demoAction(i);
              return (
                <motion.li
                  key={i.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 overflow-hidden rounded-xl border border-line bg-panel p-3.5"
                  data-testid="demo-issue"
                  data-rule={i.rule}
                >
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-mute">{RULE_TITLE[i.rule]}</p>
                    <p className="text-[13px] leading-snug">{i.message}</p>
                    {action && (
                      <button type="button" className="btn btn-primary mt-2 !h-7 px-3 text-xs" onClick={() => setProject((p) => action.apply(p))} data-testid={`demo-fix-${i.rule}`}>
                        {action.label}
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {issues.length === 0 && (
          <motion.div initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm" data-testid="demo-clean">
            <Icon name="check" size={18} className="text-ok" />
            Projeto limpo! No editor, a nota e as correções funcionam assim com os seus vídeos.
          </motion.div>
        )}
      </div>
    </div>
  );
}
