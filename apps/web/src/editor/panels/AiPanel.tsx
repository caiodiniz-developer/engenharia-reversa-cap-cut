import { useEffect, useMemo, useState } from 'react';
import { addClip, addMarker, addTrack, findClip, MediaClipSchema, newId, removeRanges, round6, type MediaClip, type Project, type Range } from '@editor/core';
import { api, ApiError } from '../../api/client';
import type { AiCapabilities } from '../../api/types';
import { ProgressBar, Section, Select } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { captionsFromWords, type TimedWord } from '../../lib/captionsFromWords';
import { formatDuration } from '../../lib/format';
import { rangeToTimeline, sourceToTimeline, sourceWindow } from '../../lib/timemap';
import { useAuth } from '../../store/auth';
import { useEditor } from '../../store/editor';
import { useJobs } from '../../store/jobs';
import { saveNow } from '../../store/persist';
import { toast } from '../../store/toasts';

interface Highlight {
  start: number;
  end: number;
  score: number;
  reason: string;
}

interface Proposal {
  summary: string;
  ops: Array<{ op: string }>;
  applied: number;
  errors: Array<{ index: number; op: string; message: string }>;
  project: Project;
}

const LANGS = [
  { value: '', label: 'Detectar automaticamente' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Francês' },
  { value: 'de', label: 'Alemão' },
  { value: 'it', label: 'Italiano' },
];

export function AiPanel({ projectId }: { projectId: string }) {
  const media = useEditor((s) => s.media);
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const user = useAuth((s) => s.user);
  const updateSettings = useAuth((s) => s.updateSettings);
  const [caps, setCaps] = useState<AiCapabilities | null>(null);
  const [mediaId, setMediaId] = useState('');
  const [lang, setLang] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [silences, setSilences] = useState<Range[] | null>(null);
  const [scenes, setScenes] = useState<number[] | null>(null);
  const [highlights, setHighlights] = useState<Highlight[] | null>(null);
  const [target, setTarget] = useState(30);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [text, setText] = useState<{ kind: string; lines: string[] } | null>(null);

  useEffect(() => {
    api.get<AiCapabilities>('/api/ai/capabilities').then(setCaps).catch(() => setCaps(null));
  }, []);

  const ready = useMemo(() => Object.values(media).filter((m) => m.status === 'ready' && m.kind !== 'image'), [media]);

  // Mídia padrão: a do clipe selecionado, senão a primeira disponível.
  const selectedClip = useMemo(() => selection.map((id) => findClip(project, id)?.clip).find((c): c is MediaClip => c?.type === 'media'), [selection, project]);
  const current = mediaId || selectedClip?.mediaId || ready[0]?.id || '';
  const currentMedia = media[current];
  const targetClip: MediaClip | undefined = useMemo(() => {
    if (selectedClip && selectedClip.mediaId === current) return selectedClip;
    for (const t of project.tracks) for (const c of t.clips) if (c.type === 'media' && c.mediaId === current && t.kind === 'video') return c;
    return undefined;
  }, [selectedClip, current, project.tracks]);

  async function runJob<T>(label: string, path: string, body: object): Promise<T | undefined> {
    setBusy(label);
    setProgress(0);
    try {
      const { jobId } = await api.post<{ jobId: string }>(path, body);
      useJobs.getState().track(jobId, label, projectId);
      const job = await useJobs.getState().waitFor(jobId, setProgress);
      if (job.status === 'succeeded') return job.result as T;
      if (job.status === 'failed') toast.error(job.error ?? 'A tarefa falhou');
      return undefined;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Falha ao executar a tarefa');
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const needMedia = () => {
    if (!current) toast.info('Importe uma mídia primeiro');
    return !!current;
  };

  // ---- Legendas automáticas ----
  async function transcribe() {
    if (!needMedia()) return;
    const r = await runJob<{ words: TimedWord[]; text: string; language: string }>('ai.transcribe', `/api/projects/${projectId}/ai/transcribe`, { mediaId: current, ...(lang ? { language: lang } : {}) });
    if (!r) return;
    if (!r.words.length) return toast.error('Nenhuma fala foi detectada nesta mídia');
    setTranscript(r.text);
    const clips = captionsFromWords(r.words, targetClip, { highlightColor: '#ffd84d' });
    if (!clips.length) return toast.info('A fala detectada está fora do trecho usado na timeline');
    useEditor.getState().addCaptionClips(clips, 'Legendas automáticas');
    toast.success(`${clips.length} legendas geradas. Revise e corrija o texto no painel de propriedades.`);
  }

  // ---- Análises locais ----
  async function analyze<T>(kind: string, extra: object = {}) {
    if (!needMedia()) return undefined;
    return runJob<T>('ai.analyze', `/api/projects/${projectId}/ai/analyze`, { mediaId: current, kind, ...extra });
  }

  async function findSilences() {
    const r = await analyze<{ silences: Range[] }>('silence', { noiseDb: -35, minDuration: 0.5 });
    if (r) {
      setSilences(r.silences);
      if (!r.silences.length) toast.info('Nenhum silêncio longo encontrado');
    }
  }

  function removeSilences(list: Range[] | null = silences) {
    if (!list?.length || !targetClip) return toast.info('Selecione o clipe na timeline para remover os silêncios');
    const ranges = list.map((r) => rangeToTimeline(targetClip, r)).filter((r): r is Range => !!r);
    if (!ranges.length) return toast.info('Os silêncios estão fora do trecho usado');
    const ok = useEditor.getState().run(`Remover ${ranges.length} silêncios`, (p) => removeRanges(p, targetClip.id, ranges));
    if (ok) toast.success(`${ranges.length} silêncios removidos`);
  }

  async function findScenes() {
    const r = await analyze<{ scenes: number[] }>('scenes', { threshold: 0.35 });
    if (!r) return;
    setScenes(r.scenes);
    if (!r.scenes.length) toast.info('Nenhuma troca de cena detectada');
  }

  function markScenes() {
    if (!scenes?.length || !targetClip) return toast.info('Selecione o clipe na timeline para marcar as cenas');
    const w = sourceWindow(targetClip);
    const times = scenes.filter((t) => t > w.start && t < w.end).map((t) => sourceToTimeline(targetClip, t));
    if (!times.length) return toast.info('Nenhuma troca de cena dentro do trecho usado');
    useEditor.getState().run('Marcar trocas de cena', (p) => times.reduce((acc, t, i) => addMarker(acc, t, `Cena ${i + 2}`, '#35d0c4').project, p));
  }

  async function suggestCuts() {
    const r = await analyze<{ silences: Range[]; scenes: number[] }>('cuts', { noiseDb: -35, minDuration: 0.6 });
    if (r) {
      setSilences(r.silences);
      setScenes(r.scenes);
      toast.info(`${r.silences.length} pausas e ${r.scenes.length} trocas de cena encontradas. Revise abaixo e aplique.`);
    }
  }

  async function findHighlights() {
    const r = await analyze<{ highlights: Highlight[] }>('highlights', { targetSeconds: target, noiseDb: -35 });
    if (r) setHighlights(r.highlights);
  }

  function buildSequence() {
    if (!highlights?.length || !current) return;
    useEditor.getState().run('Sequência com melhores trechos', (p0) => {
      let p = p0;
      if (!p.media[current] && currentMedia) p = { ...p, media: { ...p.media, [current]: { id: currentMedia.id, name: currentMedia.name, kind: currentMedia.kind, duration: currentMedia.duration, width: currentMedia.width, height: currentMedia.height, fps: currentMedia.fps, hasAudio: currentMedia.hasAudio, size: currentMedia.size, mime: currentMedia.mime } } };
      const r = addTrack(p, currentMedia?.kind === 'audio' ? 'audio' : 'video', { index: 0 });
      p = r.project;
      let t = 0;
      for (const h of highlights) {
        const dur = round6(h.end - h.start);
        p = addClip(p, r.track.id, MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId: current, start: round6(t), sourceIn: round6(h.start), duration: dur }));
        t += dur;
      }
      return p;
    });
    toast.success('Sequência criada em uma nova faixa. Edite à vontade.');
  }

  // ---- Texto: resumo e títulos (LLM) ----
  async function textTask(kind: 'summarize' | 'titles') {
    setBusy(kind);
    try {
      const r = await api.post<{ summary?: string; bullets?: string[]; titles?: string[] }>(`/api/projects/${projectId}/ai/${kind}`, { transcript });
      setText(kind === 'summarize' ? { kind: 'Resumo', lines: [r.summary ?? '', ...(r.bullets ?? []).map((b) => `• ${b}`)] } : { kind: 'Títulos sugeridos', lines: r.titles ?? [] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao consultar a IA');
    } finally {
      setBusy(null);
    }
  }

  // ---- Assistente ----
  async function ask() {
    setBusy('assistant');
    setProposal(null);
    try {
      await saveNow(); // o servidor planeja sobre o documento salvo
      const r = await api.post<Proposal & { baseRevision: number }>(`/api/projects/${projectId}/ai/assistant`, { prompt });
      setProposal(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao consultar o assistente');
    } finally {
      setBusy(null);
    }
  }

  const consent = user?.settings.aiConsent ?? false;
  const external = !!caps && (caps.transcriptionSendsDataExternally || caps.assistantSendsDataExternally);
  const blocked = external && !consent;

  return (
    <div className="h-full overflow-auto" data-testid="ai-panel">
      {busy && (
        <div className="sticky top-0 z-10 border-b border-line bg-panel px-3 py-2" role="status">
          <p className="mb-1 text-2xs text-mute">Processando… {Math.round(progress * 100)}%</p>
          <ProgressBar value={progress} label="Progresso da tarefa" />
        </div>
      )}

      {external && (
        <label className="m-3 flex items-start gap-2 card p-3 text-2xs leading-snug text-mute">
          <input type="checkbox" className="mt-0.5 accent-accent" checked={consent} onChange={(e) => void updateSettings({ aiConsent: e.target.checked })} />
          <span>
            Autorizo enviar o áudio/dados do projeto aos provedores externos de IA configurados no servidor (
            {[caps?.transcriptionSendsDataExternally && 'transcrição', caps?.assistantSendsDataExternally && 'assistente'].filter(Boolean).join(' e ')}). Análises locais (silêncio, cenas, destaques) não enviam nada.
          </span>
        </label>
      )}

      <div className="px-3 pt-3">
        <Select label="Mídia" value={current} onChange={setMediaId} options={ready.length ? ready.map((m) => ({ value: m.id, label: `${m.name} (${formatDuration(m.duration)})` })) : [{ value: '', label: 'Nenhuma mídia pronta' }]} />
      </div>

      <Section title="Legendas automáticas">
        {caps?.transcription ? (
          <>
            <Select label="Idioma da fala" value={lang} onChange={setLang} options={LANGS} />
            <button type="button" className="btn btn-primary w-full" disabled={!!busy || blocked || !current || !currentMedia?.hasAudio} onClick={() => void transcribe()}>
              <Icon name="captions" size={14} /> Gerar legendas
            </button>
            <p className="mt-2 text-2xs text-mute">Provedor: {caps.transcription === 'openai' ? 'API externa (o áudio é enviado)' : 'Whisper local no servidor'}. Os tempos de cada palavra alimentam o destaque da fala.</p>
            {!currentMedia?.hasAudio && current && <p className="mt-1 text-2xs text-danger">Esta mídia não tem áudio.</p>}
          </>
        ) : (
          <Unavailable text="Transcrição indisponível: o administrador precisa configurar WHISPER_BIN/WHISPER_MODEL (local) ou OPENAI_API_KEY no servidor." />
        )}
      </Section>

      <Section title="Silêncios e cortes">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" disabled={!!busy || !current} onClick={() => void findSilences()}>
            Detectar silêncios
          </button>
          <button type="button" className="btn" disabled={!!busy || !current} onClick={() => void suggestCuts()}>
            Sugerir cortes
          </button>
        </div>
        {silences && (
          <div className="mt-3 card p-2 text-2xs">
            <p className="mb-1 font-medium">{silences.length} silêncios{silences.length ? ` (${silences.reduce((n, r) => n + r.end - r.start, 0).toFixed(1)} s no total)` : ''}</p>
            <ul className="mb-2 max-h-24 overflow-auto font-mono text-mute">
              {silences.map((r, i) => (
                <li key={i}>
                  {r.start.toFixed(1)}s → {r.end.toFixed(1)}s
                </li>
              ))}
            </ul>
            <button type="button" className="btn w-full" disabled={!silences.length || !targetClip} onClick={() => removeSilences()}>
              Remover do clipe selecionado
            </button>
            {!targetClip && <p className="mt-1 text-mute">Coloque a mídia na timeline e selecione o clipe.</p>}
          </div>
        )}
      </Section>

      <Section title="Cenas">
        <button type="button" className="btn w-full" disabled={!!busy || !current || currentMedia?.kind !== 'video'} onClick={() => void findScenes()}>
          Detectar trocas de cena
        </button>
        {scenes && (
          <div className="mt-3 card p-2 text-2xs">
            <p className="mb-1 font-medium">{scenes.length} trocas: {scenes.slice(0, 8).map((t) => `${t.toFixed(1)}s`).join(', ')}{scenes.length > 8 ? '…' : ''}</p>
            <button type="button" className="btn w-full" disabled={!scenes.length || !targetClip} onClick={markScenes}>
              Marcar na timeline
            </button>
          </div>
        )}
      </Section>

      <Section title="Melhores trechos">
        <div className="mb-2 flex items-center gap-2">
          <label className="label !mb-0 flex-1" htmlFor="target">
            Duração alvo (s)
          </label>
          <input id="target" type="number" className="field w-20" min={3} max={600} value={target} onChange={(e) => setTarget(Math.max(3, Math.min(600, Number(e.target.value) || 30)))} />
        </div>
        <button type="button" className="btn w-full" disabled={!!busy || !current} onClick={() => void findHighlights()}>
          <Icon name="sparkles" size={14} /> Sugerir trechos
        </button>
        <p className="mt-2 text-2xs text-mute">Heurística baseada em energia do áudio, pausas e trocas de cena. É uma sugestão, não uma garantia de qualidade.</p>
        {highlights && (
          <div className="mt-3 card p-2 text-2xs">
            {highlights.length === 0 ? (
              <p>Nada sugerido para esta mídia.</p>
            ) : (
              <>
                <ul className="mb-2 max-h-28 overflow-auto font-mono text-mute">
                  {highlights.map((h, i) => (
                    <li key={i}>
                      {h.start.toFixed(1)}–{h.end.toFixed(1)}s · {(h.score * 100).toFixed(0)}%
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-primary w-full" onClick={buildSequence}>
                  Criar sequência na timeline
                </button>
              </>
            )}
          </div>
        )}
      </Section>

      <Section title="Assistente de edição" defaultOpen={false}>
        {caps?.assistant ? (
          <>
            <label className="label" htmlFor="prompt">
              O que você quer fazer?
            </label>
            <textarea id="prompt" className="field h-20 resize-none py-1.5" placeholder="Ex.: crie um vídeo vertical de 30 segundos com os melhores trechos" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button type="button" className="btn btn-primary mt-2 w-full" disabled={!!busy || blocked || prompt.trim().length < 3} onClick={() => void ask()}>
              <Icon name="wand" size={14} /> Gerar proposta
            </button>
            {proposal && (
              <div className="mt-3 card p-2 text-2xs" data-testid="proposal">
                <p className="mb-1 text-xs font-medium">{proposal.summary}</p>
                <p className="text-mute">
                  {proposal.applied} de {proposal.ops.length} operações são válidas.
                </p>
                {proposal.errors.length > 0 && (
                  <ul className="mt-1 text-danger">
                    {proposal.errors.map((e) => (
                      <li key={e.index}>
                        #{e.index + 1} {e.op}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="btn" onClick={() => setProposal(null)}>
                    Descartar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={proposal.applied === 0}
                    onClick={() => {
                      useEditor.getState().commitProject(`Assistente: ${proposal.summary.slice(0, 40)}`, proposal.project);
                      setProposal(null);
                      toast.success('Proposta aplicada. Use Ctrl+Z para desfazer.');
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Unavailable text="Assistente indisponível: configure ANTHROPIC_API_KEY no servidor." />
        )}
      </Section>

      {caps?.assistant && transcript && (
        <Section title="Resumo e títulos" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn" disabled={!!busy || blocked} onClick={() => void textTask('summarize')}>
              Resumir
            </button>
            <button type="button" className="btn" disabled={!!busy || blocked} onClick={() => void textTask('titles')}>
              Sugerir títulos
            </button>
          </div>
          {text && (
            <div className="mt-3 card p-2 text-xs">
              <p className="mb-1 text-2xs font-semibold uppercase text-mute">{text.kind}</p>
              {text.lines.map((l, i) => (
                <p key={i} className="mb-1">
                  {text.kind === 'Títulos sugeridos' ? (
                    <button type="button" className="text-left hover:text-accent" onClick={() => useEditor.getState().addText(l, { fontSize: 100 })}>
                      {l}
                    </button>
                  ) : (
                    l
                  )}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Ainda não disponíveis" defaultOpen={false}>
        <p className="text-2xs text-mute">Remoção de fundo e isolamento de voz exigem modelos de aprendizado de máquina que ainda não foram integrados. A redução de ruído está disponível nas propriedades de áudio do clipe.</p>
      </Section>
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-line px-3 py-2 text-2xs text-mute">{text}</p>;
}
