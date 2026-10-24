import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pixelAtFile, probeMedia } from './media-utils';
import { registerUser, startTestApp, toPath, type TestApp, type TestUser } from './harness';
import { assetOf, createProjectFor, makeVideo, sequenceDoc, uploadMedia } from './fixtures';
import { runRetention } from '../src/jobs';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.close());

/** Projeto com um clipe vermelho (2s) e um azul (2s). */
async function readyProject(user: TestUser) {
  const p = await createProjectFor(user, 'Meu Vídeo: final?');
  const red = await uploadMedia(t, user, p.id, await makeVideo(t.dir, `red${Math.random()}.mp4`, { duration: 2, color: 'ff0000', tone: 440 }));
  const blue = await uploadMedia(t, user, p.id, await makeVideo(t.dir, `blue${Math.random()}.mp4`, { duration: 2, color: '0000ff', tone: 660 }));
  const doc = sequenceDoc(p.data, [
    { asset: assetOf(red), duration: 2 },
    { asset: assetOf(blue), duration: 2 },
  ]);
  const saved = await user.put(`/api/projects/${p.id}`, { data: doc, baseRevision: p.revision });
  expect(saved.status).toBe(200);
  return { id: p.id, doc };
}

async function waitFor(fn: () => Promise<boolean>, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timeout aguardando condição');
}

describe('exportação', () => {
  it('renderiza no servidor, informa progresso e entrega o arquivo por link assinado', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    const created = await u.post(`/api/projects/${p.id}/exports`, { codec: 'h264', preset: 'ultrafast', width: 320, height: 180 });
    expect(created.status).toBe(202);
    await t.built.ctx.queue.onIdle();

    const status = await u.get(`/api/exports/${created.body.exportId}`);
    expect(status.body.job).toMatchObject({ status: 'succeeded', progress: 1 });
    expect(status.body.ready).toBe(true);
    expect(status.body.expiresAt).toBeTruthy();

    const dl = await u.get(`/api/exports/${created.body.exportId}/download-url`);
    expect(dl.status).toBe(200);
    const file = await t.http.get(toPath(dl.body.url)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    // Nome com acento e pontuação do projeto: ASCII no fallback e UTF-8 em filename*.
    const disposition = file.headers['content-disposition'] as string;
    expect(disposition).toMatch(/^[\x20-\x7e]+$/);
    expect(disposition).toContain('attachment; filename="Meu V_deo_ final_.mp4"');
    expect(disposition).toContain("filename*=UTF-8''Meu%20V%C3%ADdeo_%20final_.mp4");
    const out = path.join(t.dir, 'baixado.mp4');
    await writeFile(out, file.body as Buffer);

    // Valida o arquivo exportado de verdade.
    const info = await probeMedia(out);
    expect(info).toMatchObject({ width: 320, height: 180, hasAudio: true });
    expect(info.duration).toBeGreaterThan(3.9);
    expect(info.duration).toBeLessThan(4.2);
    const red = await pixelAtFile(out, 1);
    const blue = await pixelAtFile(out, 3);
    expect(red[0]).toBeGreaterThan(200);
    expect(red[2]).toBeLessThan(60);
    expect(blue[2]).toBeGreaterThan(200);
    expect(blue[0]).toBeLessThan(60);
  });

  it('usa o documento salvo no servidor, não dados enviados pelo navegador', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    // Campos extras (tentativa de injetar comando/projeto) são ignorados pela validação.
    const res = await u.post(`/api/projects/${p.id}/exports`, { preset: 'ultrafast', project: { evil: true }, ffmpegArgs: ['-f', 'x'] });
    expect(res.status).toBe(202);
    await t.built.ctx.queue.onIdle();
    const status = await u.get(`/api/exports/${res.body.exportId}`);
    expect(status.body.job.status).toBe('succeeded');
    expect(JSON.stringify(status.body.options)).not.toContain('evil');
  });

  it('valida opções e recusa projeto vazio, codec/crf inválidos e resolução excessiva', async () => {
    const u = await registerUser(t);
    const empty = await createProjectFor(u);
    const r1 = await u.post(`/api/projects/${empty.id}/exports`, {});
    expect(r1.status).toBe(422);
    expect(r1.body.code).toBe('empty_project');

    const p = await readyProject(u);
    expect((await u.post(`/api/projects/${p.id}/exports`, { codec: 'prores' })).status).toBe(400);
    expect((await u.post(`/api/projects/${p.id}/exports`, { crf: 99 })).status).toBe(400);
    const big = await u.post(`/api/projects/${p.id}/exports`, { width: 7680, height: 4320 });
    expect(big.status).toBe(422);
    expect(big.body.code).toBe('too_big');
  });

  it('isola exportações entre usuários', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await readyProject(a);
    const created = await a.post(`/api/projects/${p.id}/exports`, { preset: 'ultrafast' });
    await t.built.ctx.queue.onIdle();
    const id = created.body.exportId as string;
    expect((await b.get(`/api/exports/${id}`)).status).toBe(404);
    expect((await b.get(`/api/exports/${id}/download-url`)).status).toBe(404);
    expect((await b.post(`/api/exports/${id}/cancel`)).status).toBe(404);
    expect((await b.post(`/api/projects/${p.id}/exports`, {})).status).toBe(404);
    expect((await b.get(`/api/jobs/${created.body.jobId}`)).status).toBe(404);
    // Link assinado para o usuário A não funciona se alguém troca o dono na URL.
    const dl = await a.get(`/api/exports/${id}/download-url`);
    const forged = new URL(dl.body.url);
    forged.searchParams.set('u', b.userId);
    expect((await t.http.get(toPath(forged.href))).status).toBe(403);
    expect((await t.http.get(`/api/exports/${id}/file`)).status).toBe(403);
  });

  it('cancela uma exportação em andamento e limpa os arquivos', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    const created = await u.post(`/api/projects/${p.id}/exports`, { preset: 'slow', width: 1920, height: 1080, crf: 14 });
    await waitFor(async () => (await u.get(`/api/jobs/${created.body.jobId}`)).body.status === 'running');
    const cancel = await u.post(`/api/exports/${created.body.exportId}/cancel`);
    expect(cancel.status).toBe(202);
    await t.built.ctx.queue.onIdle();
    const job = await u.get(`/api/jobs/${created.body.jobId}`);
    expect(job.body.status).toBe('cancelled');
    const exp = await u.get(`/api/exports/${created.body.exportId}`);
    expect(exp.body.ready).toBe(false);
    expect((await u.get(`/api/exports/${created.body.exportId}/download-url`)).status).toBe(409);
    // Cancelar de novo (já terminou) é um conflito.
    expect((await u.post(`/api/exports/${created.body.exportId}/cancel`)).status).toBe(409);
  });

  it('cancela uma exportação que ainda está na fila', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    const first = await u.post(`/api/projects/${p.id}/exports`, { preset: 'slow', width: 1920, height: 1080, crf: 14 });
    const second = await u.post(`/api/projects/${p.id}/exports`, { preset: 'ultrafast' });
    await waitFor(async () => (await u.get(`/api/jobs/${first.body.jobId}`)).body.status === 'running');
    expect((await u.get(`/api/jobs/${second.body.jobId}`)).body.status).toBe('queued');
    expect((await u.post(`/api/exports/${second.body.exportId}/cancel`)).status).toBe(202);
    expect((await u.get(`/api/jobs/${second.body.jobId}`)).body.status).toBe('cancelled');
    await u.post(`/api/exports/${first.body.exportId}/cancel`);
    await t.built.ctx.queue.onIdle();
  });

  it('retenção remove arquivos expirados', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    const created = await u.post(`/api/projects/${p.id}/exports`, { preset: 'ultrafast' });
    await t.built.ctx.queue.onIdle();
    expect((await u.get(`/api/exports/${created.body.exportId}`)).body.ready).toBe(true);
    const cleaned = await runRetention(t.built.ctx, new Date(Date.now() + 48 * 3600_000));
    expect(cleaned).toBeGreaterThanOrEqual(1);
    const after = await u.get(`/api/exports/${created.body.exportId}`);
    expect(after.body.ready).toBe(false);
    expect((await u.get(`/api/exports/${created.body.exportId}/download-url`)).status).toBe(409);
  });

  it('exporta VP9/WebM e um intervalo da timeline', async () => {
    const u = await registerUser(t);
    const p = await readyProject(u);
    const created = await u.post(`/api/projects/${p.id}/exports`, { codec: 'vp9', preset: 'ultrafast', range: { start: 1, end: 3 }, width: 160, height: 90 });
    await t.built.ctx.queue.onIdle();
    const dl = await u.get(`/api/exports/${created.body.exportId}/download-url`);
    const file = await t.http.get(toPath(dl.body.url)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(file.headers['content-type']).toBe('video/webm');
    const out = path.join(t.dir, 'range.webm');
    await writeFile(out, file.body as Buffer);
    const info = await probeMedia(out);
    expect(info).toMatchObject({ videoCodec: 'vp9', width: 160, height: 90 });
    expect(info.duration).toBeGreaterThan(1.9);
    expect(info.duration).toBeLessThan(2.2);
  });
});
