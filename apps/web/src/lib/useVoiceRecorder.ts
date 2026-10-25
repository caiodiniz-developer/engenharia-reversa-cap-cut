import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'error';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function voiceRecordingSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

/** Mensagem em português para os erros mais comuns do getUserMedia. */
export function micErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permissão do microfone negada. Libere o acesso nas configurações do navegador.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Nenhum microfone foi encontrado neste dispositivo.';
  if (name === 'NotReadableError') return 'O microfone está em uso por outro aplicativo.';
  return e instanceof Error ? e.message : 'Não foi possível acessar o microfone';
}

/**
 * Grava a voz do microfone (MediaRecorder) e mede o nível em tempo real. `stop` devolve um File pronto
 * para o upload; `cancel` descarta a gravação.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const startedAt = useRef(0);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setState('requesting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      rec.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);

      // Medidor de nível (RMS do sinal).
      const ac = new AudioContext();
      ctx.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      ac.createMediaStreamSource(media).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      startedAt.current = Date.now();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000), 200);
      r.start(250);
      setState('recording');
    } catch (e) {
      cleanup();
      setError(micErrorMessage(e));
      setState('error');
    }
  }, [cleanup]);

  const stop = useCallback(
    () =>
      new Promise<File | null>((resolve) => {
        const r = rec.current;
        if (!r || r.state === 'inactive') {
          cleanup();
          setState('idle');
          return resolve(null);
        }
        r.onstop = () => {
          const type = (r.mimeType || 'audio/webm').split(';')[0]!;
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          const blob = new Blob(chunks.current, { type });
          cleanup();
          setState('idle');
          resolve(blob.size > 0 ? new File([blob], `Gravação de voz ${new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-')}.${ext}`, { type }) : null);
        };
        r.stop();
      }),
    [cleanup],
  );

  const cancel = useCallback(() => {
    const r = rec.current;
    if (r && r.state !== 'inactive') {
      r.onstop = null;
      r.stop();
    }
    cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, level, seconds, error, start, stop, cancel };
}
