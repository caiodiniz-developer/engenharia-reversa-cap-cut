import { create } from 'zustand';
import { api } from '../api/client';
import type { JobInfo, JobStatus, MediaItem, ServerEvent } from '../api/types';
import { useAuth } from './auth';
import { useEditor } from './editor';

export interface TrackedJob {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  error?: string | null;
  result?: unknown;
  projectId: string | null;
  updatedAt: number;
}

interface JobsState {
  jobs: Record<string, TrackedJob>;
  connected: boolean;
  apply(e: ServerEvent): void;
  track(jobId: string, type: string, projectId?: string | null): void;
  waitFor(jobId: string, onProgress?: (p: number) => void): Promise<TrackedJob>;
  cancel(jobId: string): Promise<void>;
}

export const JOB_LABELS: Record<string, string> = {
  export: 'Exportação',
  'media.process': 'Processando mídia',
  'ai.transcribe': 'Transcrição',
  'ai.analyze': 'Análise',
};

const waiters = new Map<string, Array<(j: TrackedJob) => void>>();
const progressListeners = new Map<string, Array<(p: number) => void>>();

export const useJobs = create<JobsState>((set, get) => ({
  jobs: {},
  connected: false,

  apply(e) {
    if (e.type === 'job') {
      const job: TrackedJob = { id: e.jobId, type: e.jobType, status: e.status, progress: e.progress, error: e.error, result: e.result, projectId: e.projectId, updatedAt: Date.now() };
      set({ jobs: { ...get().jobs, [e.jobId]: job } });
      progressListeners.get(e.jobId)?.forEach((fn) => fn(e.progress));
      if (e.status === 'succeeded' || e.status === 'failed' || e.status === 'cancelled') {
        const ws = waiters.get(e.jobId);
        if (ws) {
          ws.forEach((fn) => fn(job));
          waiters.delete(e.jobId);
          progressListeners.delete(e.jobId);
        }
      }
    } else if (e.type === 'media') {
      // Mídia processada: atualiza URLs (proxy, thumbnail, waveform) na biblioteca.
      void api
        .get<{ media: MediaItem }>(`/api/media/${e.mediaId}`)
        .then((r) => useEditor.getState().registerMedia([r.media]))
        .catch(() => {});
    }
  },

  track(jobId, type, projectId = null) {
    if (!get().jobs[jobId]) set({ jobs: { ...get().jobs, [jobId]: { id: jobId, type, status: 'queued', progress: 0, projectId, updatedAt: Date.now() } } });
  },

  /** Espera o término de uma tarefa. Consulta o estado atual para não perder um evento anterior à assinatura. */
  waitFor(jobId, onProgress) {
    return new Promise<TrackedJob>((resolve, reject) => {
      const done = (j: TrackedJob) => resolve(j);
      waiters.set(jobId, [...(waiters.get(jobId) ?? []), done]);
      if (onProgress) progressListeners.set(jobId, [...(progressListeners.get(jobId) ?? []), onProgress]);
      const check = async () => {
        try {
          const j = await api.get<JobInfo>(`/api/jobs/${jobId}`);
          if (j.status === 'succeeded' || j.status === 'failed' || j.status === 'cancelled') {
            const tracked: TrackedJob = { id: j.id, type: j.type, status: j.status, progress: j.progress, error: j.error, result: j.result, projectId: null, updatedAt: Date.now() };
            set({ jobs: { ...get().jobs, [jobId]: tracked } });
            if (waiters.has(jobId)) {
              waiters.get(jobId)!.forEach((fn) => fn(tracked));
              waiters.delete(jobId);
            }
          }
        } catch (e) {
          reject(e);
        }
      };
      void check();
      // Rede de segurança caso o WebSocket esteja fora: consulta periodicamente.
      const timer = setInterval(() => {
        if (!waiters.has(jobId)) return clearInterval(timer);
        void check();
      }, 4000);
    });
  },

  async cancel(jobId) {
    await api.post(`/api/jobs/${jobId}/cancel`);
  },
}));

/** Liga o cliente WebSocket (criado no login) ao store de tarefas. */
export function bindEvents(): () => void {
  const bind = () => {
    const ev = useAuth.getState().events;
    if (!ev) return () => {};
    useJobs.setState({ connected: ev.connected });
    const off1 = ev.on((e) => useJobs.getState().apply(e));
    const off2 = ev.onState((c) => useJobs.setState({ connected: c }));
    return () => {
      off1();
      off2();
    };
  };
  let off = bind();
  const unsub = useAuth.subscribe((s, prev) => {
    if (s.events !== prev.events) {
      off();
      off = bind();
    }
  });
  return () => {
    off();
    unsub();
  };
}
