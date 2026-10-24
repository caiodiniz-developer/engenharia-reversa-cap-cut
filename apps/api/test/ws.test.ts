import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { registerUser, startTestApp, type TestApp } from './harness';
import { createProjectFor, makeVideo, uploadMedia } from './fixtures';

let t: TestApp;
let server: Server;
let port: number;

beforeAll(async () => {
  t = await startTestApp();
  server = createServer(t.built.app);
  t.built.attach(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  server.close();
  await t.close();
});

function connect(origin = 'http://localhost:5173') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
  const messages: Array<Record<string, unknown>> = [];
  ws.on('message', (d) => messages.push(JSON.parse(d.toString())));
  const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
  const opened = new Promise<void>((r, j) => {
    ws.on('open', () => r());
    ws.on('error', j);
  });
  return { ws, messages, closed, opened };
}

const until = async (fn: () => boolean, ms = 20_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('timeout');
};

describe('WebSocket', () => {
  it('autentica pela primeira mensagem e entrega eventos de mídia e tarefas só ao dono', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const ca = connect();
    const cb = connect();
    await Promise.all([ca.opened, cb.opened]);
    ca.ws.send(JSON.stringify({ type: 'auth', token: a.token }));
    cb.ws.send(JSON.stringify({ type: 'auth', token: b.token }));
    await until(() => ca.messages.some((m) => m.type === 'ready') && cb.messages.some((m) => m.type === 'ready'));

    const p = await createProjectFor(a);
    const m = await uploadMedia(t, a, p.id, await makeVideo(t.dir, 'ws.mp4', { duration: 1, tone: 440 }));
    await until(() => ca.messages.some((e) => e.type === 'media' && e.status === 'ready'));
    const jobs = ca.messages.filter((e) => e.type === 'job');
    expect(jobs.some((e) => e.jobType === 'media.process' && e.status === 'succeeded')).toBe(true);
    expect(ca.messages.find((e) => e.type === 'media')).toMatchObject({ mediaId: m.id, projectId: p.id });
    // O outro usuário não recebe nada.
    expect(cb.messages.filter((e) => e.type !== 'ready')).toHaveLength(0);
    ca.ws.close();
    cb.ws.close();
  });

  it('fecha a conexão com token inválido, mensagem malformada ou origem não permitida', async () => {
    const bad = connect();
    await bad.opened;
    bad.ws.send(JSON.stringify({ type: 'auth', token: 'lixo' }));
    expect(await bad.closed).toBe(4401);

    const malformed = connect();
    await malformed.opened;
    malformed.ws.send('isto não é json');
    expect(await malformed.closed).toBe(4400);

    const evil = connect('http://evil.example');
    await evil.opened.catch(() => {});
    expect(await evil.closed).toBe(4403);
  });

  it('progresso da exportação chega em tempo real', async () => {
    const u = await registerUser(t);
    const c = connect();
    await c.opened;
    c.ws.send(JSON.stringify({ type: 'auth', token: u.token }));
    await until(() => c.messages.some((m) => m.type === 'ready'));

    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'e.mp4', { duration: 3, color: 'ff8800', tone: 440 }));
    const { assetOf, sequenceDoc } = await import('./fixtures');
    await u.put(`/api/projects/${p.id}`, { data: sequenceDoc(p.data, [{ asset: assetOf(m), duration: 3 }]), baseRevision: 1 });
    const exp = await u.post(`/api/projects/${p.id}/exports`, { preset: 'veryfast', width: 640, height: 360 });
    await until(() => c.messages.some((e) => e.type === 'job' && e.jobType === 'export' && e.status === 'succeeded'));
    const states = c.messages.filter((e) => e.type === 'job' && e.jobType === 'export').map((e) => e.status);
    expect(states[0]).toBe('queued');
    expect(states).toContain('running');
    expect(exp.status).toBe(202);
    c.ws.close();
  });
});
