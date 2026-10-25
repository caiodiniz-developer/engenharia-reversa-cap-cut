import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerUser, startTestApp, toPath, type TestApp } from './harness';
import { createProjectFor, makeVideo, uploadMedia } from './fixtures';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.close());

describe('mídia', () => {
  it('envia vídeo, extrai metadados e gera thumbnail, waveform e proxy', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const file = await makeVideo(t.dir, 'v.mp4', { duration: 2, color: '00ff00', tone: 440 });
    const m = await uploadMedia(t, u, p.id, file);
    expect(m).toMatchObject({ kind: 'video', width: 320, height: 180, hasAudio: true, status: 'ready' });
    expect(m.duration).toBeGreaterThan(1.9);
    expect(m.urls.thumb).toBeTruthy();
    expect(m.urls.proxy).toBeTruthy();
    expect(m.urls.waveform).toBeTruthy();

    const wf = await t.http.get(toPath(m.urls.waveform!));
    expect(wf.status).toBe(200);
    expect(Array.isArray(wf.body)).toBe(true);
    expect(Math.max(...(wf.body as number[]))).toBeGreaterThan(0.1);
    const thumb = await t.http.get(toPath(m.urls.thumb!));
    expect(thumb.headers['content-type']).toBe('image/jpeg');
    const proxy = await t.http.get(toPath(m.urls.proxy!));
    expect(proxy.headers['content-type']).toBe('video/mp4');
  });

  it('serve trechos com Range (206) para seek no navegador', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'r.mp4', { duration: 2, color: '0000ff' }));
    const full = await t.http.get(toPath(m.urls.original)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(full.status).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    const total = (full.body as Buffer).length;

    const part = await t.http.get(toPath(m.urls.original)).set('Range', 'bytes=10-99').buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 10-99/${total}`);
    expect((part.body as Buffer).length).toBe(90);
    expect((part.body as Buffer).equals((full.body as Buffer).subarray(10, 100))).toBe(true);

    const suffix = await t.http.get(toPath(m.urls.original)).set('Range', 'bytes=-50');
    expect(suffix.status).toBe(206);
    expect((await t.http.get(toPath(m.urls.original)).set('Range', `bytes=${total + 10}-`)).status).toBe(416);
  });

  it('URLs assinadas: recusa assinatura adulterada, expirada ou de outro usuário', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    const m = await uploadMedia(t, a, p.id, await makeVideo(t.dir, 's.mp4', { duration: 1 }));
    const url = new URL(m.urls.original);
    expect((await t.http.get(toPath(m.urls.original))).status).toBe(200);

    const tampered = new URL(url);
    tampered.searchParams.set('sig', 'A'.repeat(43));
    expect((await t.http.get(toPath(tampered.href))).status).toBe(403);

    const otherUser = new URL(url);
    otherUser.searchParams.set('u', b.userId);
    expect((await t.http.get(toPath(otherUser.href))).status).toBe(403);

    const expired = new URL(url);
    expired.searchParams.set('exp', '1000');
    expect((await t.http.get(toPath(expired.href))).status).toBe(403);

    expect((await t.http.get(`/api/files/${m.id}/original`)).status).toBe(403);
    expect((await t.http.get(toPath(m.urls.original).replace('/original', '/../../etc'))).status).toBeGreaterThanOrEqual(400);
  });

  it('o dono de outro projeto não vê nem apaga a mídia', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    const m = await uploadMedia(t, a, p.id, await makeVideo(t.dir, 'o.mp4', { duration: 1 }));
    expect((await b.get(`/api/media/${m.id}`)).status).toBe(404);
    expect((await b.del(`/api/media/${m.id}`)).status).toBe(404);
    expect((await b.get(`/api/projects/${p.id}/media`)).status).toBe(404);
    const list = await a.get(`/api/projects/${p.id}/media`);
    expect(list.body.media).toHaveLength(1);
  });

  it('rejeita arquivos que não são mídia, mesmo com extensão/MIME de vídeo', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const fake = path.join(t.dir, 'falso.mp4');
    await writeFile(fake, 'isto não é um vídeo, é só texto');
    const res = await t.http.post(`/api/projects/${p.id}/media`).set(u.auth).attach('file', fake, { contentType: 'video/mp4' });
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('invalid_media');
    const text = await t.http.post(`/api/projects/${p.id}/media`).set(u.auth).attach('file', fake, { contentType: 'text/plain' });
    expect(text.status).toBe(415);
    expect((await t.http.post(`/api/projects/${p.id}/media`).set(u.auth)).status).toBe(415);
  });

  it('impõe limites de tamanho e de duração', async () => {
    const small = await startTestApp({ env: { MAX_UPLOAD_BYTES: 2000, MAX_MEDIA_SECONDS: 1 } });
    try {
      const u = await registerUser(small);
      const p = await createProjectFor(u);
      const file = await makeVideo(small.dir, 'big.mp4', { duration: 3 });
      const tooBig = await small.http.post(`/api/projects/${p.id}/media`).set(u.auth).attach('file', file, { contentType: 'video/mp4' });
      expect(tooBig.status).toBe(413);
      const init = await u.post(`/api/projects/${p.id}/uploads`, { filename: 'a.mp4', size: 5000, mime: 'video/mp4' });
      expect(init.status).toBe(413);
    } finally {
      await small.close();
    }
    const short = await startTestApp({ env: { MAX_MEDIA_SECONDS: 1 } });
    try {
      const u = await registerUser(short);
      const p = await createProjectFor(u);
      const file = await makeVideo(short.dir, 'long.mp4', { duration: 3 });
      const res = await short.http.post(`/api/projects/${p.id}/media`).set(u.auth).attach('file', file, { contentType: 'video/mp4' });
      expect(res.status).toBe(413);
      expect(res.body.code).toBe('too_long');
    } finally {
      await short.close();
    }
  });

  it('upload resumível: envia em partes, retoma após interrupção e recusa offset errado', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const file = await makeVideo(t.dir, 'chunk.mp4', { duration: 2, color: 'ff00ff', tone: 300 });
    const bytes = await readFile(file);
    const init = await u.post(`/api/projects/${p.id}/uploads`, { filename: 'chunk.mp4', size: bytes.length, mime: 'video/mp4' });
    expect(init.status).toBe(201);
    const id = init.body.uploadId as string;

    const half = Math.floor(bytes.length / 2);
    const first = await t.http.patch(`/api/uploads/${id}`).set(u.auth).set('Upload-Offset', '0').set('Content-Type', 'application/octet-stream').send(bytes.subarray(0, half));
    expect(first.body.offset).toBe(half);

    // "Queda de conexão": o cliente consulta onde parou.
    const status = await u.get(`/api/uploads/${id}`);
    expect(status.body.offset).toBe(half);

    const wrong = await t.http.patch(`/api/uploads/${id}`).set(u.auth).set('Upload-Offset', '5').set('Content-Type', 'application/octet-stream').send(bytes.subarray(5, 10));
    expect(wrong.status).toBe(409);
    expect(wrong.body.details.offset).toBe(half);

    expect((await u.post(`/api/uploads/${id}/complete`)).status).toBe(409); // incompleto

    const rest = await t.http.patch(`/api/uploads/${id}`).set(u.auth).set('Upload-Offset', String(half)).set('Content-Type', 'application/octet-stream').send(bytes.subarray(half));
    expect(rest.body.offset).toBe(bytes.length);
    const done = await u.post(`/api/uploads/${id}/complete`);
    expect(done.status).toBe(201);
    expect(done.body.media).toMatchObject({ kind: 'video', width: 320 });
    await t.built.ctx.queue.onIdle();
    // O upload temporário é descartado.
    expect((await u.get(`/api/uploads/${id}`)).status).toBe(404);
  });

  it('upload de outro usuário não pode ser lido nem alterado', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    const init = await a.post(`/api/projects/${p.id}/uploads`, { filename: 'x.mp4', size: 100, mime: 'video/mp4' });
    const id = init.body.uploadId as string;
    expect((await b.get(`/api/uploads/${id}`)).status).toBe(404);
    expect((await t.http.patch(`/api/uploads/${id}`).set(b.auth).set('Upload-Offset', '0').send(Buffer.from('x'))).status).toBe(404);
    expect((await b.get('/api/uploads/../../etc')).status).toBe(404);
    expect((await b.post(`/api/projects/${p.id}/uploads`, { filename: 'x.mp4', size: 10, mime: 'video/mp4' })).status).toBe(404);
  });

  it('exclui a mídia e seus arquivos', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'd.mp4', { duration: 1 }));
    expect((await t.http.get(toPath(m.urls.original))).status).toBe(200);
    expect((await u.del(`/api/media/${m.id}`)).status).toBe(204);
    expect((await u.get(`/api/media/${m.id}`)).status).toBe(404);
    expect((await t.http.get(toPath(m.urls.original))).status).toBe(404);
  });

  it('pagina a biblioteca por cursor', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const file = await makeVideo(t.dir, 'pg.mp4', { duration: 1 });
    for (let i = 0; i < 3; i++) await uploadMedia(t, u, p.id, file);
    const page1 = await u.get(`/api/projects/${p.id}/media?limit=2`);
    expect(page1.body.media).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await u.get(`/api/projects/${p.id}/media?limit=2&cursor=${page1.body.nextCursor}`);
    expect(page2.body.media).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();
  });
});

describe('tira de quadros', () => {
  it('vídeos ganham uma tira de miniaturas com a grade informada pela API', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'film.mp4', { duration: 3, color: 'ff8800' }));
    const media = (await u.get(`/api/media/${m.id}`)).body.media;
    expect(media.film).toMatchObject({ count: 3, interval: 1, tileH: 64 });
    expect(media.urls.film).toBeTruthy();
    const img = await t.http.get(toPath(media.urls.film));
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
  });

  it('imagens e áudios não têm tira de quadros', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const res = await u.post(`/api/projects/${p.id}/generated`, { kind: 'solid', color: '#224466' });
    await t.built.ctx.queue.onIdle();
    const media = (await u.get(`/api/media/${res.body.media.id}`)).body.media;
    expect(media.film).toBeNull();
    expect(media.urls.film).toBeNull();
  });
});
