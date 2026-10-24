import { createServer, type Server } from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ffmpegRun } from '@editor/render';
import { registerUser, startTestApp, type TestApp, type TestUser } from './harness';
import { createProjectFor, makeVideo, uploadMedia } from './fixtures';

/** Servidor que imita os provedores externos (OpenAI/Anthropic) apenas na borda de rede. */
interface Fake {
  server: Server;
  url: string;
  requests: Array<{ url: string; headers: Record<string, string | string[] | undefined>; body: string }>;
  respond: (url: string) => { status: number; body: unknown };
}

async function startFake(respond: Fake['respond']): Promise<Fake> {
  const requests: Fake['requests'] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      requests.push({ url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks).toString('latin1') });
      const r = respond(req.url ?? '');
      res.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests, respond };
}

async function waitJob(t: TestApp, u: TestUser, jobId: string) {
  await t.built.ctx.queue.onIdle();
  return (await u.get(`/api/jobs/${jobId}`)).body;
}

describe('IA sem provedores configurados', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await startTestApp();
  });
  afterAll(() => t.close());

  it('informa capacidades e não simula o que não está configurado', async () => {
    const u = await registerUser(t);
    const caps = await u.get('/api/ai/capabilities');
    expect(caps.body).toMatchObject({ transcription: null, assistant: false });
    expect(caps.body.unsupported).toContain('background-removal');

    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'a.mp4', { duration: 2, tone: 440 }));
    const tr = await u.post(`/api/projects/${p.id}/ai/transcribe`, { mediaId: m.id });
    expect(tr.status).toBe(503);
    expect(tr.body.code).toBe('ai_not_configured');
    const as = await u.post(`/api/projects/${p.id}/ai/assistant`, { prompt: 'faça um vídeo curto' });
    expect(as.status).toBe(503);
    expect((await u.post(`/api/projects/${p.id}/ai/titles`, { transcript: 'a'.repeat(50) })).status).toBe(503);
  });

  it('detecta silêncio, cenas, batidas e sugere cortes/destaques com análise local', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    // 1s de tom + 2s de silêncio + 1s de tom; vídeo vermelho (2s) seguido de azul (2s).
    const file = path.join(t.dir, 'mix.mp4');
    await ffmpegRun([
      '-y', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30:d=2', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
      '-filter_complex', '[0][1]concat=n=2:v=1:a=0[v];[2][3][4]concat=n=3:v=0:a=1[a]',
      '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file,
    ]);
    const m = await uploadMedia(t, u, p.id, file);

    const run = async (body: object) => {
      const r = await u.post(`/api/projects/${p.id}/ai/analyze`, { mediaId: m.id, ...body });
      expect(r.status).toBe(202);
      const job = await waitJob(t, u, r.body.jobId);
      expect(job.status).toBe('succeeded');
      return job.result;
    };

    const sil = await run({ kind: 'silence', noiseDb: -40, minDuration: 0.5 });
    expect(sil.silences).toHaveLength(1);
    expect(sil.silences[0].start).toBeCloseTo(1, 0);
    expect(sil.silences[0].end).toBeCloseTo(3, 0);

    const scenes = await run({ kind: 'scenes', threshold: 0.3 });
    expect(scenes.scenes).toHaveLength(1);
    expect(scenes.scenes[0]).toBeCloseTo(2, 0);

    const cuts = await run({ kind: 'cuts', noiseDb: -40 });
    expect(cuts.silences).toHaveLength(1);
    expect(cuts.scenes).toHaveLength(1);
    expect(cuts.method).toMatch(/heuristic/);

    const hl = await run({ kind: 'highlights', targetSeconds: 3, noiseDb: -40 });
    expect(hl.method).toMatch(/suggestion only/);
    const total = hl.highlights.reduce((n: number, h: { start: number; end: number }) => n + (h.end - h.start), 0);
    expect(total).toBeLessThanOrEqual(4);
    for (const h of hl.highlights) {
      // Nenhum destaque cai dentro do silêncio detectado.
      expect(h.end <= 1.2 || h.start >= 2.8).toBe(true);
    }

    const beats = await run({ kind: 'beats' });
    expect(Array.isArray(beats.beats)).toBe(true);
  });

  it('validações: mídia de outro projeto e parâmetros inválidos', async () => {
    const u = await registerUser(t);
    const p1 = await createProjectFor(u);
    const p2 = await createProjectFor(u);
    const m = await uploadMedia(t, u, p1.id, await makeVideo(t.dir, 'x.mp4', { duration: 1 }));
    expect((await u.post(`/api/projects/${p2.id}/ai/analyze`, { mediaId: m.id, kind: 'silence' })).status).toBe(404);
    expect((await u.post(`/api/projects/${p1.id}/ai/analyze`, { mediaId: m.id, kind: 'magia' })).status).toBe(400);
    expect((await u.post(`/api/projects/${p1.id}/ai/analyze`, { mediaId: m.id, kind: 'silence', noiseDb: 5 })).status).toBe(400);
  });
});

describe('IA com provedores configurados (borda de rede simulada)', () => {
  let t: TestApp;
  let openai: Fake;
  let anthropic: Fake;
  let plan: unknown;

  beforeAll(async () => {
    openai = await startFake(() => ({
      status: 200,
      body: { language: 'portuguese', text: 'olá mundo isto é um teste', words: [{ word: 'olá', start: 0, end: 0.4 }, { word: 'mundo', start: 0.5, end: 0.9 }, { word: 'isto', start: 1, end: 1.2 }] },
    }));
    plan = { summary: 'ok', ops: [] };
    anthropic = await startFake(() => ({ status: 200, body: { content: [{ type: 'text', text: JSON.stringify(plan) }] } }));
    process.env.ANTHROPIC_BASE_URL = anthropic.url;
    t = await startTestApp({ env: { OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: openai.url, ANTHROPIC_API_KEY: 'ak-test', AI_DAILY_CALL_LIMIT: 4 } });
  });
  afterAll(async () => {
    delete process.env.ANTHROPIC_BASE_URL;
    openai.server.close();
    anthropic.server.close();
    await t.close();
  });

  it('transcreve: envia o áudio ao provedor com a chave só no servidor e devolve palavras com tempo', async () => {
    const u = await registerUser(t);
    const caps = await u.get('/api/ai/capabilities');
    expect(caps.body.transcription).toBe('openai');
    expect(caps.body.transcriptionSendsDataExternally).toBe(true);

    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'fala.mp4', { duration: 2, tone: 300 }));
    const r = await u.post(`/api/projects/${p.id}/ai/transcribe`, { mediaId: m.id, language: 'pt' });
    expect(r.status).toBe(202);
    const job = await waitJob(t, u, r.body.jobId);
    expect(job.status).toBe('succeeded');
    expect(job.result).toMatchObject({ mediaId: m.id, language: 'portuguese', provider: 'openai' });
    expect(job.result.words).toHaveLength(3);
    expect(job.result.words[1]).toEqual({ text: 'mundo', start: 0.5, end: 0.9 });

    const sent = openai.requests.at(-1)!;
    expect(sent.url).toBe('/audio/transcriptions');
    expect(sent.headers.authorization).toBe('Bearer sk-test');
    expect(sent.body).toContain('verbose_json');
    expect(sent.body).toContain('RIFF'); // arquivo WAV enviado
    expect(JSON.stringify(job)).not.toContain('sk-test');
  });

  it('mídia sem áudio não pode ser transcrita', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'mudo.mp4', { duration: 1, color: '112233' }));
    const r = await u.post(`/api/projects/${p.id}/ai/transcribe`, { mediaId: m.id });
    expect(r.status).toBe(422);
  });

  it('assistente: valida as operações propostas com a timeline e reporta as inválidas', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'src.mp4', { duration: 10, color: '00ff00', tone: 440 }));
    // Documento com a mídia registrada (o assistente recebe ids reais).
    const { assetOf } = await import('./fixtures');
    const { addMedia } = await import('@editor/core');
    await u.put(`/api/projects/${p.id}`, { data: addMedia(p.data, assetOf(m)), baseRevision: 1 });

    plan = {
      summary: 'Vertical de 6s com dois trechos e título',
      ops: [
        { op: 'format', width: 1080, height: 1920 },
        { op: 'addClip', mediaId: m.id, sourceIn: 1, duration: 3 },
        { op: 'addClip', mediaId: m.id, sourceIn: 5, duration: 3 },
        { op: 'addText', text: 'Melhores momentos', start: 0, duration: 2, y: -0.3 },
        { op: 'addClip', mediaId: 'inexistente', sourceIn: 0, duration: 1 },
        { op: 'addClip', mediaId: m.id, sourceIn: 9, duration: 5 },
      ],
    };
    const res = await u.post(`/api/projects/${p.id}/ai/assistant`, { prompt: 'Crie um vídeo vertical de 6 segundos com os melhores trechos' });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(4);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors.map((e: { index: number }) => e.index)).toEqual([4, 5]);
    expect(res.body.errors[0].message).toMatch(/não existe/);
    expect(res.body.errors[1].message).toMatch(/duração da mídia/);
    expect(res.body.project.settings).toMatchObject({ width: 1080, height: 1920 });
    const video = res.body.project.tracks.find((tr: { kind: string }) => tr.kind === 'video');
    expect(video.clips.map((c: { start: number; duration: number }) => [c.start, c.duration])).toEqual([[0, 3], [3, 3]]);
    expect(res.body.project.tracks.some((tr: { kind: string }) => tr.kind === 'text')).toBe(true);

    // O servidor devolve uma PROPOSTA: nada foi gravado no projeto.
    const stored = await u.get(`/api/projects/${p.id}`);
    expect(stored.body.project.data.tracks).toHaveLength(0);
    expect(stored.body.project.revision).toBe(2);

    // O contexto enviado ao modelo contém os ids reais da mídia e o pedido.
    const prompt = JSON.parse(anthropic.requests.at(-1)!.body).messages[0].content as string;
    expect(prompt).toContain(m.id);
    expect(prompt).toContain('vertical de 6 segundos');
    expect(anthropic.requests.at(-1)!.headers['x-api-key']).toBe('ak-test');
  });

  it('assistente: resposta fora do formato vira 502 e plano com operação desconhecida é recusado', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    plan = { summary: 'x', ops: [{ op: 'formatarDisco' }] };
    const bad = await u.post(`/api/projects/${p.id}/ai/assistant`, { prompt: 'faça algo estranho' });
    expect(bad.status).toBe(502);
    expect(bad.body.code).toBe('ai_provider_error');
    expect((await u.post(`/api/projects/${p.id}/ai/assistant`, { prompt: 'x' })).status).toBe(400);
  });

  it('resumo e títulos usam o LLM e respeitam o orçamento diário', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    plan = { summary: 'Resumo curto', bullets: ['a', 'b'] };
    const s = await u.post(`/api/projects/${p.id}/ai/summarize`, { transcript: 'Um texto longo o bastante para resumir.' });
    expect(s.status).toBe(200);
    expect(s.body).toEqual({ summary: 'Resumo curto', bullets: ['a', 'b'] });
    plan = { titles: ['Título 1'] };
    const ti = await u.post(`/api/projects/${p.id}/ai/titles`, { transcript: 'Um texto longo o bastante para titular.' });
    expect(ti.body.titles).toEqual(['Título 1']);
    // Limite de 4 chamadas/dia: 2 já usadas + 2 permitidas, depois 429.
    plan = { titles: ['x'] };
    await u.post(`/api/projects/${p.id}/ai/titles`, { transcript: 'Um texto longo o bastante para titular.' });
    await u.post(`/api/projects/${p.id}/ai/titles`, { transcript: 'Um texto longo o bastante para titular.' });
    const over = await u.post(`/api/projects/${p.id}/ai/titles`, { transcript: 'Um texto longo o bastante para titular.' });
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('ai_budget');
  });
});
