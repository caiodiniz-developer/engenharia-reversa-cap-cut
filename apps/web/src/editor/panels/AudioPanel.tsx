import { useMemo, useRef, useState } from 'react';
import { findClip, type MediaClip } from '@editor/core';
import { api, ApiError } from '../../api/client';
import { ProgressBar } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { formatBytes, formatDuration } from '../../lib/format';
import { rangeToTimeline } from '../../lib/timemap';
import { micErrorMessage, useVoiceRecorder, voiceRecordingSupported } from '../../lib/useVoiceRecorder';
import { useEditor } from '../../store/editor';
import { useJobs } from '../../store/jobs';
import { toast } from '../../store/toasts';
import { useUploads } from '../../store/uploads';

export function AudioPanel({ projectId }: { projectId: string }) {
  const media = useEditor((s) => s.media);
  const addToTimeline = useEditor((s) => s.addToTimeline);
  const markBeats = useEditor((s) => s.markBeats);
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);
  const upload = useUploads((s) => s.upload);
  const rec = useVoiceRecorder();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const tracks = useMemo(() => Object.values(media).filter((m) => m.kind === 'audio').sort((a, b) => a.name.localeCompare(b.name, 'pt')), [media]);
  const selectedClip = useMemo(() => selection.map((id) => findClip(project, id)?.clip).find((c): c is MediaClip => c?.type === 'media' && (media[c.mediaId]?.hasAudio ?? false)), [selection, project, media]);

  async function finishRecording() {
    const file = await rec.stop();
    if (!file) return toast.error('A gravação ficou vazia');
    setBusy('Enviando gravação…');
    try {
      const item = await upload(projectId, file);
      if (item) {
        addToTimeline(item.id, { at: useEditor.getState().playhead });
        toast.success('Voz gravada e adicionada à timeline');
      }
    } finally {
      setBusy(null);
    }
  }

  async function detectBeats() {
    if (!selectedClip) return toast.info('Selecione na timeline um clipe com áudio (música)');
    setBusy('Detectando batidas…');
    setProgress(0);
    try {
      const { jobId } = await api.post<{ jobId: string }>(`/api/projects/${projectId}/ai/analyze`, { mediaId: selectedClip.mediaId, kind: 'beats' });
      useJobs.getState().track(jobId, 'ai.analyze', projectId);
      const job = await useJobs.getState().waitFor(jobId, setProgress);
      if (job.status !== 'succeeded') return toast.error(job.error ?? 'Não foi possível analisar o ritmo');
      const beats = (job.result as { beats: number[] }).beats;
      const times = beats.map((b) => rangeToTimeline(selectedClip, { start: b, end: b + 1e-3 })?.start).filter((t): t is number => t !== undefined);
      if (!times.length) return toast.info('Nenhuma batida clara foi encontrada no trecho usado');
      markBeats(times);
      toast.success(`${times.length} marcadores de batida adicionados à régua`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Falha ao analisar o áudio');
    } finally {
      setBusy(null);
    }
  }

  const recording = rec.state === 'recording';
  const supported = voiceRecordingSupported();

  return (
    <div className="h-full overflow-auto" data-testid="audio-panel">
      <section className="border-b border-line p-3">
        <h3 className="mb-2 text-xs font-semibold">Gravar voz</h3>
        {supported ? (
          <>
            {recording ? (
              <div className="card p-3" role="status" aria-live="polite">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-danger">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Gravando
                  </span>
                  <span className="tnum font-mono text-xs" data-testid="rec-time">
                    {formatDuration(rec.seconds)}
                  </span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-line" aria-label="Nível do microfone">
                  <div className="h-full rounded-full bg-gradient-to-r from-ok via-warn to-danger transition-[width] duration-75" style={{ width: `${Math.round(rec.level * 100)}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn" onClick={rec.cancel}>
                    Descartar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void finishRecording()} data-testid="rec-stop">
                    <Icon name="stop" size={13} /> Parar e usar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-primary h-9 w-full" disabled={rec.state === 'requesting' || !!busy} onClick={() => void rec.start()} data-testid="rec-start">
                <Icon name="circleDot" size={15} /> {rec.state === 'requesting' ? 'Aguardando permissão…' : 'Começar a gravar'}
              </button>
            )}
            {rec.error && (
              <p role="alert" className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-2xs text-danger">
                {rec.error}
              </p>
            )}
            <p className="mt-2 text-2xs leading-relaxed text-mute">A gravação entra na faixa de áudio, na posição do cursor. O navegador vai pedir acesso ao microfone.</p>
          </>
        ) : (
          <p className="text-2xs text-mute">{micErrorMessage({ name: 'NotFoundError' })} (este navegador não oferece gravação)</p>
        )}
        {busy && (
          <div className="mt-2" role="status">
            <p className="mb-1 text-2xs text-mute">{busy}</p>
            <ProgressBar value={progress} label={busy} />
          </div>
        )}
      </section>

      <section className="border-b border-line p-3">
        <h3 className="mb-2 text-xs font-semibold">Ritmo da música</h3>
        <button type="button" className="btn w-full" disabled={!selectedClip || !!busy} onClick={() => void detectBeats()}>
          <Icon name="wave" size={14} /> Marcar batidas do clipe selecionado
        </button>
        <p className="mt-2 text-2xs leading-relaxed text-mute">Detecta picos de energia do áudio e coloca marcadores na régua. Com o ímã ligado, os cortes encaixam nas batidas.</p>
      </section>

      <section className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">Biblioteca de áudio</h3>
          <input ref={fileRef} type="file" accept="audio/*" multiple className="sr-only" aria-label="Importar áudio" data-testid="audio-input" onChange={(e) => e.target.files && (Array.from(e.target.files).forEach((f) => void upload(projectId, f)), (e.target.value = ''))} />
          <button type="button" className="btn !h-7 px-2 text-2xs" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={12} /> Importar
          </button>
        </div>
        {tracks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-2xs text-mute">Nenhum áudio ainda. Importe uma música ou grave sua voz.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="audio-list">
            {tracks.map((m) => (
              <li key={m.id} className="card flex items-center gap-2 p-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clip-audio/25 text-clip-audio">
                  <Icon name="music" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium" title={m.name}>
                    {m.name}
                  </span>
                  <span className="text-2xs text-mute">
                    {formatDuration(m.duration)} · {formatBytes(m.size)}
                  </span>
                </span>
                <button type="button" className="btn-icon" aria-label={`Adicionar ${m.name} à timeline`} onClick={() => addToTimeline(m.id, { at: useEditor.getState().playhead })}>
                  <Icon name="plus" size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

