import { useEffect, useState } from 'react';
import { projectDuration } from '@editor/core';
import { api, ApiError } from '../api/client';
import type { ExportInfo } from '../api/types';
import { Modal, ProgressBar, Segmented, Select } from '../components/controls';
import { Icon } from '../components/Icon';
import { EXPORT_PRESETS, getExportPreset, matchPreset } from '../lib/exportPresets';
import { estimateAudioBytes } from '../lib/audioSize';
import { formatBytes, formatDuration } from '../lib/format';
import { localRecordingSupported, recordLocalDraft, RecordCancelled } from '../lib/localRecord';
import { useEditor } from '../store/editor';
import { useJobs } from '../store/jobs';
import { saveNow } from '../store/persist';
import { toast } from '../store/toasts';

type Codec = 'h264' | 'h265' | 'vp9';
type AudioFormat = 'mp3' | 'm4a' | 'wav';
type Res = 'project' | '2160' | '1080' | '720' | '480';

const QUALITY = [
  { value: '18', label: 'Alta (arquivo maior)' },
  { value: '21', label: 'Equilibrada' },
  { value: '26', label: 'Compacta (arquivo menor)' },
];

export function ExportDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const jobs = useJobs((s) => s.jobs);
  const workArea = useEditor((s) => s.workArea);
  const [useRange, setUseRange] = useState(true);
  const [codec, setCodec] = useState<Codec>('h264');
  const [res, setRes] = useState<Res>('project');
  const [fps, setFps] = useState<string>('project');
  const [crf, setCrf] = useState('21');
  const [kind, setKind] = useState<'video' | 'audio' | 'gif'>('video');
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<{ exportId: string; jobId: string } | null>(null);
  const [history, setHistory] = useState<ExportInfo[]>([]);

  const fullDuration = projectDuration(project);
  const range = workArea && useRange ? workArea : null;
  const duration = range ? range.end - range.start : fullDuration;
  const gifTooLong = kind === 'gif' && duration > 30;
  const job = current ? jobs[current.jobId] : undefined;
  const running = job && (job.status === 'queued' || job.status === 'running');

  const { width, height } = (() => {
    const s = project.settings;
    if (res === 'project') return { width: s.width, height: s.height };
    const target = Number(res);
    // A resolução escolhida refere-se ao lado menor, preservando a proporção do projeto.
    const scale = target / Math.min(s.width, s.height);
    return { width: Math.round((s.width * scale) / 2) * 2, height: Math.round((s.height * scale) / 2) * 2 };
  })();

  const refresh = () => api.get<{ exports: ExportInfo[] }>(`/api/projects/${projectId}/exports`).then((r) => setHistory(r.exports)).catch(() => {});
  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.status]);

  const presetId = matchPreset({ kind, codec, res, fps: fps as never, crf: crf as never, audioFormat });
  function applyPreset(id: string) {
    const p = getExportPreset(id);
    if (!p) return;
    setKind(p.kind);
    setCodec(p.codec);
    setRes(p.res);
    setFps(p.fps);
    setCrf(p.crf);
    setAudioFormat(p.audioFormat);
  }

  /** GIF é limitado a 720p; ao escolhê-lo, sai de resoluções maiores. */
  function changeKind(next: 'video' | 'audio' | 'gif') {
    setKind(next);
    if (next === 'gif') {
      if (res !== '480' && res !== '720') setRes('480');
      if (fps === 'project' || Number(fps) > 30) setFps('15');
    }
  }

  async function start() {
    setBusy(true);
    try {
      await saveNow(); // exporta o documento salvo no servidor
      const rangeBody = range ? { range: { start: range.start, end: range.end } } : {};
      const body = kind === 'audio' ? { audioOnly: audioFormat, ...rangeBody } : kind === 'gif' ? { ...rangeBody, gif: true, width, height, fps: Number(fps === 'project' ? 15 : fps) } : { ...rangeBody, codec, crf: Number(crf), width, height, ...(fps !== 'project' ? { fps: Number(fps) } : {}), preset: 'veryfast' };
      const r = await api.post<{ exportId: string; jobId: string }>(`/api/projects/${projectId}/exports`, body);
      useJobs.getState().track(r.jobId, 'export', projectId);
      setCurrent(r);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível iniciar a exportação');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!current) return;
    try {
      await api.post(`/api/exports/${current.exportId}/cancel`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao cancelar');
    }
  }

  async function download(id: string) {
    try {
      const r = await api.get<{ url: string }>(`/api/exports/${id}/download-url`);
      const a = document.createElement('a');
      a.href = r.url;
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arquivo indisponível (pode ter expirado)');
    }
  }

  const done = job?.status === 'succeeded';

  // Rascunho local: grava o preview no próprio navegador (sem renderizar no servidor).
  const [localProgress, setLocalProgress] = useState<number | null>(null);
  const [localAbort, setLocalAbort] = useState<AbortController | null>(null);
  async function recordLocal() {
    const ctrl = new AbortController();
    setLocalAbort(ctrl);
    setLocalProgress(0);
    try {
      const blob = await recordLocalDraft({ onProgress: setLocalProgress, signal: ctrl.signal });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'rascunho'}-rascunho.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('Rascunho gravado. Ele tem a qualidade da prévia; use "Exportar" para o arquivo final.');
    } catch (e) {
      if (!(e instanceof RecordCancelled)) toast.error(e instanceof Error ? e.message : 'Falha ao gravar o rascunho');
    } finally {
      setLocalProgress(null);
      setLocalAbort(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Exportar vídeo" width={520}>
      <div className="mb-3 card px-3 py-2 text-2xs text-mute">
        A renderização acontece no servidor: suas mídias já enviadas são processadas por lá e o arquivo final fica disponível para download por tempo limitado (24 h por padrão).
      </div>

      <Select label="Predefinição" value={presetId} onChange={applyPreset} options={[...EXPORT_PRESETS.map((p) => ({ value: p.id, label: p.label })), ...(presetId === 'custom' ? [{ value: 'custom', label: 'Personalizada' }] : [])]} />
      {getExportPreset(presetId) && <p className="-mt-1 mb-3 text-2xs text-mute">{getExportPreset(presetId)!.description}</p>}

      <div className="mb-3">
        <Segmented label="Tipo de exportação" value={kind} onChange={changeKind} options={[{ value: 'video', label: 'Vídeo' }, { value: 'audio', label: 'Somente áudio' }, { value: 'gif', label: 'GIF' }]} />
      </div>

      {kind === 'audio' ? (
        <div className="grid grid-cols-2 gap-x-4">
          <Select label="Formato do áudio" value={audioFormat} onChange={setAudioFormat} options={[{ value: 'mp3', label: 'MP3 (compatível)' }, { value: 'm4a', label: 'M4A · AAC' }, { value: 'wav', label: 'WAV (sem compressão)' }]} />
        </div>
      ) : kind === 'gif' ? (
        <div className="grid grid-cols-2 gap-x-4">
          <Select label="Resolução do GIF" value={res} onChange={setRes} options={[{ value: '480', label: 'Pequeno (480)' }, { value: '720', label: 'Médio (720)' }]} />
          <Select label="Quadros por segundo do GIF" value={fps} onChange={setFps} options={[10, 12, 15, 20, 24].map((f) => ({ value: String(f), label: `${f} fps` }))} />
          <p className="col-span-2 mb-2 text-2xs text-mute">GIF não tem áudio e aceita até 30 s: marque um trecho com I e O para exportar só uma parte.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-x-4">
        <Select label="Formato" value={codec} onChange={setCodec} options={[{ value: 'h264', label: 'MP4 · H.264 (compatível)' }, { value: 'h265', label: 'MP4 · H.265 (menor)' }, { value: 'vp9', label: 'WebM · VP9' }]} />
        <Select label="Qualidade" value={crf} onChange={setCrf} options={QUALITY} />
        <Select label="Resolução" value={res} onChange={setRes} options={[{ value: 'project', label: `Do projeto (${project.settings.width}×${project.settings.height})` }, { value: '2160', label: '4K (lado menor 2160)' }, { value: '1080', label: 'Full HD (1080)' }, { value: '720', label: 'HD (720)' }, { value: '480', label: 'SD (480)' }]} />
        <Select label="Quadros por segundo" value={fps} onChange={setFps} options={[{ value: 'project', label: `Do projeto (${project.settings.fps})` }, ...[24, 25, 30, 50, 60].map((f) => ({ value: String(f), label: `${f} fps` }))]} />
      </div>
      )}
      {workArea && (
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} data-testid="use-range" />
          Exportar só o trecho marcado ({formatDuration(workArea.start)} – {formatDuration(workArea.end)})
        </label>
      )}
      <p className="mb-3 text-2xs text-mute">
        Saída: {kind === 'audio' ? `áudio ${audioFormat.toUpperCase()}${duration > 0 ? ` · ${audioFormat === 'm4a' ? 'até ' : '≈ '}${formatBytes(estimateAudioBytes(audioFormat, duration, project.settings.sampleRate))}` : ''}` : kind === 'gif' ? `GIF ${width}×${height}` : `${width}×${height}`} · duração {formatDuration(duration)}
      </p>

      {job && (
        <div className="mb-3 card p-3" role="status" data-testid="export-status">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span>
              {job.status === 'queued' && 'Na fila…'}
              {job.status === 'running' && `Renderizando… ${Math.round(job.progress * 100)}%`}
              {job.status === 'succeeded' && 'Exportação concluída'}
              {job.status === 'failed' && 'A exportação falhou'}
              {job.status === 'cancelled' && 'Exportação cancelada'}
            </span>
            {running && (
              <button type="button" className="text-2xs text-mute hover:text-danger" onClick={() => void cancel()}>
                Cancelar
              </button>
            )}
          </div>
          <ProgressBar value={job.status === 'succeeded' ? 1 : job.progress} label="Progresso da exportação" />
          {job.status === 'failed' && <p className="mt-2 text-2xs text-danger">{job.error}</p>}
          {done && current && (
            <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void download(current.exportId)} data-testid="download-button">
              <Icon name="download" size={14} /> Baixar arquivo
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !!running || duration <= 0 || gifTooLong} onClick={() => void start()} data-testid="start-export">
          {busy ? 'Enviando…' : 'Exportar'}
        </button>
      </div>
      {gifTooLong && <p className="mt-2 text-right text-2xs text-danger" role="alert">O GIF aceita até 30 s. Marque um trecho menor com I e O.</p>}
      {duration <= 0 && <p className="mt-2 text-right text-2xs text-mute">Adicione clipes à timeline para exportar.</p>}

      {localRecordingSupported() && (
        <div className="mt-5 card p-3" data-testid="local-draft">
          <h3 className="mb-1 text-xs font-semibold">Rascunho rápido no navegador</h3>
          <p className="mb-2 text-2xs text-mute">Grava a prévia em tempo real e baixa um WebM, sem renderizar no servidor. Qualidade da prévia (até 960 px); estabilização, normalização e redução de ruído não entram.</p>
          {localProgress === null ? (
            <button type="button" className="btn w-full" disabled={duration <= 0 || !!running} onClick={() => void recordLocal()} data-testid="record-local">
              <Icon name="film" size={14} /> Gravar rascunho (WebM)
            </button>
          ) : (
            <div role="status">
              <div className="mb-1 flex items-center justify-between text-2xs">
                <span>Gravando… {Math.round(localProgress * 100)}%</span>
                <button type="button" className="text-mute hover:text-danger" onClick={() => localAbort?.abort()}>
                  Cancelar
                </button>
              </div>
              <ProgressBar value={localProgress} label="Progresso da gravação" />
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <h3 className="panel-title !px-0">Exportações anteriores</h3>
          <ul className="space-y-1">
            {history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-md bg-panel-2 px-2 py-1.5 text-2xs">
                <span className="text-mute">
                  {String(h.options.gif ? 'gif' : (h.options.audioOnly ?? h.options.codec ?? '')).toUpperCase()} · {h.job.status === 'succeeded' ? (h.ready ? formatBytes(h.sizeBytes ?? 0) : 'expirado') : h.job.status}
                </span>
                {h.ready && (
                  <button type="button" className="text-accent hover:underline" onClick={() => void download(h.id)}>
                    Baixar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
