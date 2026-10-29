import { Icon } from '../../components/Icon';

const ROWS: Array<{ tone: 'danger' | 'warn' | 'accent'; title: string; text: string; fix?: string }> = [
  { tone: 'warn', title: 'Espaços vazios', text: 'Espaço vazio de 3,0 s em “Vídeo 1” (a partir de 0:12)', fix: 'Fechar espaços da faixa' },
  { tone: 'warn', title: 'Legendas rápidas demais', text: 'Legenda em 0:34 passa de 20 caracteres por segundo' },
  { tone: 'danger', title: 'Mídia ampliada além da resolução', text: '“entrevista.mp4” está ampliada 210% — vai ficar borrada' },
  { tone: 'accent', title: 'Mídias não usadas', text: '2 mídias importadas não são usadas em nenhum clipe' },
];

const TONE = { danger: 'text-danger', warn: 'text-amber-400', accent: 'text-accent' } as const;

/** Vitrine do diferencial “Revisão do projeto”: uma amostra visual do painel real, com notas e verificações. */
export function ReviewShowcase() {
  return (
    <div className="card mx-auto mt-14 max-w-4xl overflow-hidden" data-testid="review-showcase" aria-label="Exemplo do painel de revisão">
      <div className="grid gap-0 md:grid-cols-[260px_1fr]">
        <div className="border-b border-line bg-panel-2/60 p-6 md:border-b-0 md:border-r">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-mute">Notas do projeto</p>
          {[
            { label: 'Qualidade', v: 82, tone: 'text-amber-400' },
            { label: 'Acessibilidade', v: 100, tone: 'text-ok' },
          ].map((n) => (
            <div key={n.label} className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
              <svg width="52" height="52" viewBox="0 0 52 52" className={n.tone} aria-hidden="true">
                <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="5" />
                <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(n.v / 100) * 138.2} 138.2`} transform="rotate(-90 26 26)" />
                <text x="26" y="30" textAnchor="middle" className="fill-current text-[13px] font-semibold">
                  {n.v}
                </text>
              </svg>
              <div>
                <p className="text-sm font-semibold">{n.label}</p>
                <p className="text-xs text-mute">{n.v >= 90 ? 'Ótimo' : 'Pode melhorar'}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-mute">Exemplo ilustrativo. No editor, as notas e os alertas refletem o seu projeto de verdade.</p>
        </div>
        <ul className="space-y-2.5 p-6">
          {ROWS.map((r) => (
            <li key={r.title} className="flex items-start gap-3 rounded-xl border border-line bg-panel p-3.5">
              <Icon name={r.tone === 'accent' ? 'info' : 'alert'} size={16} className={`mt-0.5 shrink-0 ${TONE[r.tone]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-mute">{r.title}</p>
                <p className="text-[13px] leading-snug">{r.text}</p>
                {r.fix && <span className="mt-2 inline-block rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-ink">{r.fix}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
