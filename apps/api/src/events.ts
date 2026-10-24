export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobEvent {
  type: 'job';
  jobId: string;
  jobType: string;
  projectId: string | null;
  status: JobStatus;
  progress: number;
  error?: string | null;
  result?: unknown;
}

export interface MediaEvent {
  type: 'media';
  mediaId: string;
  projectId: string;
  status: string;
  error?: string | null;
}

export type ServerEvent = JobEvent | MediaEvent;

/** Barramento em memória: cada WebSocket autenticado assina os eventos do seu usuário. */
export class EventBus {
  private subs = new Map<string, Set<(e: ServerEvent) => void>>();

  subscribe(userId: string, fn: (e: ServerEvent) => void): () => void {
    let set = this.subs.get(userId);
    if (!set) this.subs.set(userId, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.subs.delete(userId);
    };
  }

  emit(userId: string, event: ServerEvent): void {
    for (const fn of this.subs.get(userId) ?? []) {
      try {
        fn(event);
      } catch {
        /* um assinante com erro não pode afetar os demais */
      }
    }
  }
}
