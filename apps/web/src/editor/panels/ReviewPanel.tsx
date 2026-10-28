import { useMemo, useState } from 'react';
import {
  buildDescription,
  HISTOGRAM_LABELS,
  pacingCurve,
  pacingLabel,
  pacingStats,
  parseTodo,
  PLATFORMS,
  RULE_TITLE,
  scriptText,
  stillStretches,
  timelineCsv,
  toEdl,
  todoSummary,
  type ReviewIssue,
} from '@editor/core';
import { Check, Section, Select } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { downloadText, fileBase } from '../../lib/download';
import { useReview } from '../../lib/useReview';
import { formatDuration } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';

function ScoreRing({ value, label, testId }: { value: number; label: string; testId: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = value >= 90 ? 'text-ok' : value >= 60 ? 'text-amber-400' : 'text-danger';
  return (
    <div className="card flex flex-1 items-center gap-3 px-3 py-2.5" data-testid={testId}>
      <svg width="52" height="52" viewBox="0 0 52 52" className={tone} role="img" aria-label={`${label}: ${value} de 100`}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 26 26)" />
        <text x="26" y="30" textAnchor="middle" className="fill-current text-[13px] font-semibold">
          {value}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{label}</p>
        <p className="text-2xs text-mute">{value >= 90 ? 'Ótimo' : value >= 60 ? 'Pode melhorar' : 'Precisa de atenção'}</p>
      </div>
    </div>
  );
}

const SEV_ICON = { erro: 'text-danger', aviso: 'text-amber-400', dica: 'text-accent' } as const;

function IssueRow({ issue }: { issue: ReviewIssue }) {
  const go = useEditor((s) => s.goToIssue);
  const fix = useEditor((s) => s.applyReviewFix);
  return (
    <li className="card flex items-start gap-2 px-2.5 py-2" data-testid="issue" data-rule={issue.rule} data-severity={issue.severity}>
      <Icon name={issue.severity === 'dica' ? 'info' : 'alert'} size={14} className={`mt-0.5 shrink-0 ${SEV_ICON[issue.severity]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold text-mute">{RULE_TITLE[issue.rule]}</p>
        <p className="text-xs leading-snug">{issue.message}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(issue.time !== undefined || issue.clipIds?.length) && (
            <button type="button" className="btn !h-6 px-2 text-2xs" onClick={() => go(issue)} aria-label={`Ir até: ${issue.message}`}>
              Ir até
            </button>
          )}
          {issue.fix && (
            <button type="button" className="btn btn-primary !h-6 px-2 text-2xs" onClick={() => fix(issue)} data-testid={`fix-${issue.fix.kind}`}>
              {issue.fix.label}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function Pacing() {
  const project = useEditor((s) => s.project);
  const stats = useMemo(() => pacingStats(project), [project]);
  const curve = useMemo(() => pacingCurve(project, 5), [project]);
  const still = useMemo(() => stillStretches(project, 5, 3), [project]);
  if (!stats) return <p className="text-2xs text-mute">Adicione vídeos ou imagens para ver o ritmo da edição.</p>;
  const maxH = Math.max(1, ...stats.histogram);
  const maxC = Math.max(1, ...curve);
  return (
    <div data-testid="pacing">
      <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Planos', String(stats.shots)],
          ['Duração média', `${String(stats.average).replace('.', ',')} s`],
          ['Cortes/min', String(stats.cutsPerMinute).replace('.', ',')],
        ].map(([k, v]) => (
          <div key={k} className="card px-1 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-mute">{k}</dt>
            <dd className="tnum text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-2 text-xs">
        Ritmo: <strong data-testid="pacing-label">{pacingLabel(stats.average)}</strong> · mediana {String(stats.median).replace('.', ',')} s · de {String(stats.shortest).replace('.', ',')} a {String(stats.longest).replace('.', ',')} s
      </p>
      <div className="mb-3 flex items-end gap-1.5" role="img" aria-label="Quantidade de planos por duração">
        {stats.histogram.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="tnum text-[10px] text-mute">{n}</span>
            <span className="w-full rounded-t bg-accent/70" style={{ height: Math.max(2, (n / maxH) * 44) }} />
            <span className="text-[10px] text-mute">{HISTOGRAM_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <p className="mb-1 text-2xs font-medium text-mute">Cortes ao longo do vídeo (a cada 5 s)</p>
      <div className="flex h-10 items-end gap-px rounded-md bg-panel-2 p-1" role="img" aria-label="Mapa de ritmo">
        {curve.map((n, i) => (
          <span key={i} className={`flex-1 rounded-sm ${n === 0 ? 'bg-line' : 'bg-accent'}`} style={{ height: Math.max(2, (n / maxC) * 100) + '%' }} title={`${formatDuration(i * 5)}: ${n} ${n === 1 ? 'corte' : 'cortes'}`} />
        ))}
      </div>
      {still.length > 0 && (
        <p className="mt-2 text-2xs text-amber-400" data-testid="still-warning">
          Trechos parados (15 s ou mais sem corte): {still.map((s) => `${formatDuration(s.start)}–${formatDuration(s.end)}`).join(', ')}
        </p>
      )}
    </div>
  );
}

function Tasks() {
  const project = useEditor((s) => s.project);
  const addTask = useEditor((s) => s.addTask);
  const toggle = useEditor((s) => s.toggleTask);
  const [text, setText] = useState('');
  const tasks = project.markers.map((m) => ({ m, t: parseTodo(m.label) })).filter((x) => x.t.isTodo);
  const sum = todoSummary(project.markers);
  const go = (time: number) => {
    const st = useEditor.getState();
    st.setPlaying(false);
    st.setPlayhead(time);
  };
  return (
    <div data-testid="tasks">
      <form
        className="mb-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          addTask(text);
          setText('');
        }}
      >
        <input className="field flex-1" placeholder="Ex.: trocar a música aqui" aria-label="Nova tarefa de edição" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} />
        <button type="submit" className="btn" disabled={!text.trim()} title="Cria a tarefa na posição da cabeça de reprodução">
          <Icon name="plus" size={13} /> Adicionar
        </button>
      </form>
      {tasks.length === 0 ? (
        <p className="text-2xs text-mute">Anote o que falta fazer em cada ponto do vídeo. Cada tarefa vira um marcador na régua.</p>
      ) : (
        <>
          <p className="mb-1.5 text-2xs text-mute" data-testid="task-summary">
            {sum.done} de {sum.total} concluídas
          </p>
          <ul className="space-y-1">
            {tasks.map(({ m, t }) => (
              <li key={m.id} className="card flex items-center gap-2 px-2.5 py-1.5">
                <input type="checkbox" checked={t.done} onChange={() => toggle(m.id)} aria-label={`Concluir tarefa: ${t.text}`} />
                <button type="button" className={`min-w-0 flex-1 truncate text-left text-xs ${t.done ? 'text-mute line-through' : ''}`} onClick={() => go(m.time)} title="Ir até a tarefa">
                  {t.text}
                </button>
                <span className="tnum font-mono text-2xs text-mute">{formatDuration(m.time)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Exports() {
  const project = useEditor((s) => s.project);
  const base = fileBase(project.name);
  const script = scriptText(project);
  return (
    <div className="grid grid-cols-2 gap-1.5" data-testid="lists">
      <button type="button" className="btn justify-start px-2 text-2xs" data-testid="export-edl" onClick={() => downloadText(`${base}.edl`, toEdl(project))}>
        <Icon name="download" size={13} /> Lista EDL
      </button>
      <button type="button" className="btn justify-start px-2 text-2xs" data-testid="export-csv" onClick={() => downloadText(`${base}-timeline.csv`, timelineCsv(project), 'text/csv;charset=utf-8', true)}>
        <Icon name="download" size={13} /> Planilha CSV
      </button>
      <button
        type="button"
        className="btn justify-start px-2 text-2xs"
        data-testid="export-script"
        onClick={() => (script ? downloadText(`${base}-roteiro.txt`, script) : toast.info('O projeto não tem textos nem legendas'))}
      >
        <Icon name="download" size={13} /> Roteiro (.txt)
      </button>
      <button
        type="button"
        className="btn justify-start px-2 text-2xs"
        data-testid="copy-description"
        onClick={() =>
          navigator.clipboard.writeText(buildDescription(project)).then(
            () => toast.success('Descrição copiada (título, capítulos e mídias)'),
            () => toast.error('Não foi possível copiar. Permita o acesso à área de transferência.'),
          )
        }
      >
        <Icon name="copy" size={13} /> Copiar descrição
      </button>
    </div>
  );
}

/** Revisão do projeto: notas, verificações com correção, plataforma de destino, ritmo, tarefas e listas para exportar. */
export function ReviewPanel() {
  const project = useEditor((s) => s.project);
  const platformId = useEditor((s) => s.platformId);
  const showSafe = useEditor((s) => s.showSafeZones);
  const setPlatform = useEditor((s) => s.setPlatform);
  const toggleSafe = useEditor((s) => s.toggleSafeZones);

  const { issues, score, access } = useReview();
  const hasClips = project.tracks.some((t) => t.clips.length > 0);

  return (
    <div className="h-full overflow-auto" data-testid="review-panel">
      <div className="space-y-3 border-b border-line p-3">
        <div className="flex gap-2">
          <ScoreRing value={score} label="Qualidade" testId="score-quality" />
          <ScoreRing value={access} label="Acessibilidade" testId="score-access" />
        </div>
        <Select label="Plataforma de destino" value={platformId ?? ''} onChange={(v) => setPlatform(v || null)} options={[{ value: '', label: 'Nenhuma' }, ...PLATFORMS.map((p) => ({ value: p.id, label: p.label }))]} />
        <Check label="Mostrar zonas cobertas pela interface no preview" checked={showSafe} onChange={() => toggleSafe()} />
        <p className="text-2xs leading-relaxed text-mute">Zonas e durações são aproximações práticas; as plataformas mudam seus layouts com frequência.</p>
      </div>

      <Section title={`Verificações${issues.length ? ` (${issues.length})` : ''}`} icon="check">
        {!hasClips ? (
          <p className="text-2xs text-mute">Adicione clipes à timeline para revisar o projeto.</p>
        ) : issues.length === 0 ? (
          <p className="text-xs text-ok" data-testid="no-issues">
            Nenhum problema encontrado.
          </p>
        ) : (
          <ul className="space-y-1.5" data-testid="issues">
            {issues.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Ritmo da edição" icon="zap" defaultOpen={false}>
        <Pacing />
      </Section>

      <Section title="Tarefas de edição" icon="flag" defaultOpen={false}>
        <Tasks />
      </Section>

      <Section title="Listas e roteiros" icon="download" defaultOpen={false}>
        <Exports />
      </Section>
    </div>
  );
}
