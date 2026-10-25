import { projectDuration } from '@editor/core';
import { getEngine } from '../engine/registry';
import { useEditor } from '../store/editor';

export class RecordCancelled extends Error {
  constructor() {
    super('Gravação cancelada');
  }
}

export function localRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

const MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

/**
 * Grava o preview (canvas + áudio mixado) em tempo real com MediaRecorder e devolve um WebM.
 * É a exportação "leve" no navegador: sem upload e sem servidor, mas em tempo real e com a qualidade
 * do preview (até 960 px de largura). Efeitos que só existem na exportação do servidor (estabilização,
 * normalização, redução de ruído) não entram.
 */
export async function recordLocalDraft(opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<Blob> {
  const engine = getEngine();
  if (!engine) throw new Error('O preview não está disponível');
  if (!localRecordingSupported()) throw new Error('Este navegador não suporta gravação local (MediaRecorder)');
  const store = useEditor.getState();
  const total = projectDuration(store.project);
  if (total <= 0) throw new Error('Adicione clipes à timeline antes de gravar');

  const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('Nenhum formato WebM suportado para gravação');

  store.setPlaying(false);
  store.setRate(1); // o rascunho é gravado em tempo real
  store.setPlayhead(0);
  engine.invalidate();
  // Espera o primeiro quadro ser desenhado antes de iniciar.
  await new Promise((r) => setTimeout(r, 400));

  const cap = engine.captureStream(store.project.settings.fps);
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(cap.stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (rec.onstop = () => resolve()));

  let unsub = () => {};
  const finished = new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(new RecordCancelled());
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    unsub = useEditor.subscribe((s) => {
      opts.onProgress?.(Math.min(1, s.playhead / total));
      // O motor para a reprodução sozinho ao chegar ao fim da timeline.
      if (!s.playing && s.playhead >= total - 0.05) resolve();
    });
  });

  rec.start(500);
  useEditor.getState().setPlaying(true);
  try {
    await finished;
  } finally {
    unsub();
    useEditor.getState().setPlaying(false);
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    cap.stop();
  }
  opts.onProgress?.(1);
  return new Blob(chunks, { type: mime.split(';')[0] });
}
