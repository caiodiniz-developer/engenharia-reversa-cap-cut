import type { Job, Prisma, PrismaClient } from '@prisma/client';
import type { EventBus, JobStatus } from './events';

/** Erro que não deve ser repetido (entrada inválida, projeto vazio...). */
export class NonRetryableError extends Error {}

export interface JobContext {
  job: Job;
  signal: AbortSignal;
  /** 0..1 */
  progress(fraction: number): void;
}

/** O resultado deve ser serializável em JSON; é gravado em Job.result. */
export type JobHandler = (ctx: JobContext) => Promise<unknown>;

interface HandlerSpec {
  handler: JobHandler;
  lane: string;
  timeoutMs: number;
}

export interface QueueOptions {
  maxAttempts: number;
  /** Concorrência máxima por "lane" (ex.: export=1, processing=2). */
  lanes: Record<string, number>;
}

/**
 * Fila de tarefas persistida no PostgreSQL (estado, progresso, resultado e tentativas), com execução em
 * processo. Limita a concorrência por lane, aplica timeout, cancelamento e retentativas controladas.
 * Para escalar horizontalmente basta mover `run` para workers consumindo a mesma tabela (SELECT ... FOR UPDATE
 * SKIP LOCKED) ou trocar por BullMQ mantendo esta interface.
 */
export class JobQueue {
  private handlers = new Map<string, HandlerSpec>();
  private running = new Map<string, AbortController>();
  private laneActive = new Map<string, number>();
  private pending: string[] = [];
  private stopped = false;
  private idleWaiters: Array<() => void> = [];

  constructor(
    private db: PrismaClient,
    private events: EventBus,
    private opts: QueueOptions,
  ) {}

  register(type: string, lane: string, handler: JobHandler, timeoutMs = 60 * 60_000): void {
    this.handlers.set(type, { handler, lane, timeoutMs });
  }

  async enqueue(input: { type: string; ownerId: string; projectId?: string | null; payload?: Prisma.InputJsonValue }): Promise<Job> {
    if (!this.handlers.has(input.type)) throw new Error(`Tipo de tarefa desconhecido: ${input.type}`);
    const job = await this.db.job.create({
      data: { type: input.type, ownerId: input.ownerId, projectId: input.projectId ?? null, payload: input.payload ?? {} },
    });
    this.emit(job, 'queued', 0);
    this.pending.push(job.id);
    void this.pump();
    return job;
  }

  /** Coloca na fila um job já criado no banco (usado quando outro registro precisa referenciá-lo antes). */
  async adopt(jobId: string): Promise<void> {
    const job = await this.db.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'queued') return;
    this.emit(job, 'queued', 0);
    this.pending.push(job.id);
    void this.pump();
  }

  /** Ao iniciar o servidor: tarefas que estavam em execução voltam para a fila; as enfileiradas são retomadas. */
  async recover(): Promise<void> {
    await this.db.job.updateMany({ where: { status: 'running' }, data: { status: 'queued' } });
    const queued = await this.db.job.findMany({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    for (const j of queued) if (!this.pending.includes(j.id)) this.pending.push(j.id);
    void this.pump();
  }

  async cancel(jobId: string): Promise<boolean> {
    const ctrl = this.running.get(jobId);
    if (ctrl) {
      ctrl.abort();
      return true;
    }
    const idx = this.pending.indexOf(jobId);
    if (idx !== -1) this.pending.splice(idx, 1);
    const res = await this.db.job.updateMany({ where: { id: jobId, status: 'queued' }, data: { status: 'cancelled', finishedAt: new Date() } });
    if (res.count > 0) {
      const job = await this.db.job.findUnique({ where: { id: jobId } });
      if (job) this.emit(job, 'cancelled', job.progress);
      return true;
    }
    return false;
  }

  /** Aguarda a fila esvaziar (testes e desligamento gracioso). */
  onIdle(): Promise<void> {
    if (this.pending.length === 0 && this.running.size === 0) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const c of this.running.values()) c.abort();
    await this.onIdle();
  }

  private emit(job: Job, status: JobStatus, progress: number, extra: { error?: string | null; result?: unknown } = {}): void {
    this.events.emit(job.ownerId, { type: 'job', jobId: job.id, jobType: job.type, projectId: job.projectId, status, progress, ...extra });
  }

  private async pump(): Promise<void> {
    if (this.stopped) return;
    for (let i = 0; i < this.pending.length; ) {
      const id = this.pending[i]!;
      const job = await this.db.job.findUnique({ where: { id } });
      if (!job || job.status !== 'queued') {
        this.pending.splice(this.pending.indexOf(id), 1);
        continue;
      }
      const spec = this.handlers.get(job.type);
      if (!spec) {
        this.pending.splice(this.pending.indexOf(id), 1);
        continue;
      }
      const limit = this.opts.lanes[spec.lane] ?? 1;
      if ((this.laneActive.get(spec.lane) ?? 0) >= limit) {
        i++;
        continue;
      }
      this.pending.splice(this.pending.indexOf(id), 1);
      this.laneActive.set(spec.lane, (this.laneActive.get(spec.lane) ?? 0) + 1);
      void this.execute(job, spec).finally(() => {
        this.laneActive.set(spec.lane, (this.laneActive.get(spec.lane) ?? 1) - 1);
        void this.pump().then(() => this.checkIdle());
      });
    }
    this.checkIdle();
  }

  private checkIdle(): void {
    if (this.pending.length === 0 && this.running.size === 0) {
      const waiters = this.idleWaiters.splice(0);
      for (const w of waiters) w();
    }
  }

  private async execute(job: Job, spec: HandlerSpec): Promise<void> {
    const ctrl = new AbortController();
    this.running.set(job.id, ctrl);
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), spec.timeoutMs);
    const attempts = job.attempts + 1;
    let last = 0;
    let lastEmit = 0;
    const started = await this.db.job.update({ where: { id: job.id }, data: { status: 'running', attempts, startedAt: new Date(), error: null } });
    this.emit(started, 'running', 0);
    try {
      const result = await spec.handler({
        job: started,
        signal: ctrl.signal,
        progress: (f) => {
          last = Math.max(0, Math.min(1, f));
          const now = Date.now();
          if (now - lastEmit > 250) {
            lastEmit = now;
            this.emit(started, 'running', last);
            void this.db.job.update({ where: { id: job.id }, data: { progress: last } }).catch(() => {});
          }
        },
      });
      if (ctrl.signal.aborted) throw ctrl.signal.reason ?? new Error('cancelled');
      const done = await this.db.job.update({
        where: { id: job.id },
        data: { status: 'succeeded', progress: 1, result: (result ?? undefined) as Prisma.InputJsonValue | undefined, finishedAt: new Date() },
      });
      this.emit(done, 'succeeded', 1, { result });
    } catch (err) {
      const aborted = ctrl.signal.aborted;
      const timedOut = aborted && ctrl.signal.reason instanceof Error && ctrl.signal.reason.message === 'timeout';
      if (aborted && !timedOut && !this.stopped) {
        const j = await this.db.job.update({ where: { id: job.id }, data: { status: 'cancelled', finishedAt: new Date() } });
        this.emit(j, 'cancelled', last);
      } else {
        const message = timedOut ? 'Tempo limite excedido' : err instanceof Error ? err.message : String(err);
        const retry = !timedOut && !this.stopped && !(err instanceof NonRetryableError) && attempts < this.opts.maxAttempts;
        if (retry) {
          const j = await this.db.job.update({ where: { id: job.id }, data: { status: 'queued', error: message } });
          this.emit(j, 'queued', 0, { error: message });
          this.pending.push(job.id);
        } else {
          const j = await this.db.job.update({ where: { id: job.id }, data: { status: 'failed', error: message, finishedAt: new Date() } });
          this.emit(j, 'failed', last, { error: message });
        }
      }
    } finally {
      clearTimeout(timer);
      this.running.delete(job.id);
    }
  }
}
