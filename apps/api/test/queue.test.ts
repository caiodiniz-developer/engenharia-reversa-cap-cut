import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventBus, type JobEvent } from '../src/events';
import { JobQueue, NonRetryableError } from '../src/queue';
import { registerUser, startTestApp, type TestApp } from './harness';

let t: TestApp;
let userId: string;
beforeAll(async () => {
  t = await startTestApp();
  userId = (await registerUser(t)).userId;
});
afterAll(() => t.close());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeQueue(opts: { maxAttempts?: number; lanes?: Record<string, number> } = {}) {
  const events = new EventBus();
  const seen: JobEvent[] = [];
  events.subscribe(userId, (e) => e.type === 'job' && seen.push(e));
  const q = new JobQueue(t.built.ctx.db, events, { maxAttempts: opts.maxAttempts ?? 2, lanes: opts.lanes ?? { a: 1 } });
  return { q, seen };
}

describe('fila de tarefas', () => {
  it('executa com progresso e grava o resultado', async () => {
    const { q, seen } = makeQueue();
    q.register('t.ok', 'a', async ({ progress }) => {
      progress(0.5);
      await sleep(300);
      return { answer: 42 };
    });
    const job = await q.enqueue({ type: 't.ok', ownerId: userId });
    await q.onIdle();
    const row = await t.built.ctx.db.job.findUnique({ where: { id: job.id } });
    expect(row).toMatchObject({ status: 'succeeded', progress: 1, attempts: 1, result: { answer: 42 } });
    expect(row!.startedAt && row!.finishedAt).toBeTruthy();
    const mine = seen.filter((e) => e.jobId === job.id).map((e) => e.status);
    expect(mine[0]).toBe('queued');
    expect(mine).toContain('running');
    expect(mine.at(-1)).toBe('succeeded');
    expect(seen.some((e) => e.jobId === job.id && e.progress === 0.5)).toBe(true);
  });

  it('respeita o limite de concorrência por lane', async () => {
    const { q } = makeQueue({ lanes: { a: 2 } });
    let active = 0;
    let peak = 0;
    q.register('t.conc', 'a', async () => {
      active++;
      peak = Math.max(peak, active);
      await sleep(150);
      active--;
    });
    for (let i = 0; i < 6; i++) await q.enqueue({ type: 't.conc', ownerId: userId });
    await q.onIdle();
    expect(peak).toBe(2);
  });

  it('lanes diferentes não se bloqueiam', async () => {
    const { q } = makeQueue({ lanes: { slow: 1, fast: 1 } });
    const order: string[] = [];
    q.register('t.slow', 'slow', async () => {
      await sleep(400);
      order.push('slow');
    });
    q.register('t.fast', 'fast', async () => {
      order.push('fast');
    });
    await q.enqueue({ type: 't.slow', ownerId: userId });
    await q.enqueue({ type: 't.fast', ownerId: userId });
    await q.onIdle();
    expect(order).toEqual(['fast', 'slow']);
  });

  it('repete uma vez após falha transitória e depois conclui', async () => {
    const { q } = makeQueue({ maxAttempts: 2 });
    let calls = 0;
    q.register('t.flaky', 'a', async () => {
      if (++calls === 1) throw new Error('falha de disco');
      return { calls };
    });
    const job = await q.enqueue({ type: 't.flaky', ownerId: userId });
    await q.onIdle();
    const row = await t.built.ctx.db.job.findUnique({ where: { id: job.id } });
    expect(row).toMatchObject({ status: 'succeeded', attempts: 2 });
  });

  it('esgota as tentativas e marca como falha com a mensagem', async () => {
    const { q } = makeQueue({ maxAttempts: 2 });
    q.register('t.broken', 'a', async () => {
      throw new Error('sempre falha');
    });
    const job = await q.enqueue({ type: 't.broken', ownerId: userId });
    await q.onIdle();
    const row = await t.built.ctx.db.job.findUnique({ where: { id: job.id } });
    expect(row).toMatchObject({ status: 'failed', attempts: 2, error: 'sempre falha' });
  });

  it('erro não repetível falha na primeira tentativa', async () => {
    const { q } = makeQueue({ maxAttempts: 5 });
    q.register('t.fatal', 'a', async () => {
      throw new NonRetryableError('entrada inválida');
    });
    const job = await q.enqueue({ type: 't.fatal', ownerId: userId });
    await q.onIdle();
    expect(await t.built.ctx.db.job.findUnique({ where: { id: job.id } })).toMatchObject({ status: 'failed', attempts: 1 });
  });

  it('cancela tarefa em execução (sinal de abort) e tarefa na fila', async () => {
    const { q } = makeQueue();
    let aborted = false;
    q.register('t.long', 'a', async ({ signal }) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => { aborted = true; resolve(); }));
      throw new Error('interrompido');
    });
    const running = await q.enqueue({ type: 't.long', ownerId: userId });
    const queued = await q.enqueue({ type: 't.long', ownerId: userId });
    await sleep(300);
    expect(await q.cancel(queued.id)).toBe(true);
    expect(await q.cancel(running.id)).toBe(true);
    await q.onIdle();
    expect(aborted).toBe(true);
    const db = t.built.ctx.db;
    expect((await db.job.findUnique({ where: { id: running.id } }))!.status).toBe('cancelled');
    expect((await db.job.findUnique({ where: { id: queued.id } }))!.status).toBe('cancelled');
    expect(await q.cancel(running.id)).toBe(false);
  });

  it('aplica timeout e não repete', async () => {
    const { q } = makeQueue({ maxAttempts: 3 });
    q.register('t.hang', 'a', async ({ signal }) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
    }, 200);
    const job = await q.enqueue({ type: 't.hang', ownerId: userId });
    await q.onIdle();
    expect(await t.built.ctx.db.job.findUnique({ where: { id: job.id } })).toMatchObject({ status: 'failed', attempts: 1, error: 'Tempo limite excedido' });
  });

  it('recover: tarefas que estavam em execução voltam para a fila e terminam', async () => {
    const db = t.built.ctx.db;
    const { q } = makeQueue();
    q.register('t.recover', 'a', async () => ({ recovered: true }));
    // Simula um processo que morreu no meio da execução.
    const orphan = await db.job.create({ data: { type: 't.recover', ownerId: userId, status: 'running', attempts: 1 } });
    await q.recover();
    await q.onIdle();
    expect(await db.job.findUnique({ where: { id: orphan.id } })).toMatchObject({ status: 'succeeded', result: { recovered: true } });
  });

  it('tipo desconhecido é recusado', async () => {
    const { q } = makeQueue();
    await expect(q.enqueue({ type: 'nao.existe', ownerId: userId })).rejects.toThrow(/desconhecido/);
  });
});
