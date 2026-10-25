import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerUser, startTestApp, toPath, type TestApp } from './harness';
import { createProjectFor } from './fixtures';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.close());

describe('mídias geradas', () => {
  it('cria um fundo de cor sólida como imagem pronta, com as dimensões do projeto', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const res = await u.post(`/api/projects/${p.id}/generated`, { kind: 'solid', color: '#336699' });
    expect(res.status).toBe(201);
    expect(res.body.media).toMatchObject({ kind: 'image', width: 1920, height: 1080, name: 'Fundo 336699.png' });
    await t.built.ctx.queue.onIdle();
    const media = (await u.get(`/api/media/${res.body.media.id}`)).body.media;
    expect(media.status).toBe('ready');
    expect(media.urls.thumb).toBeTruthy();
    const img = await t.http.get(toPath(media.urls.original));
    expect(img.headers['content-type']).toBe('image/png');
  });

  it('degradê com tamanho e nome próprios', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const res = await u.post(`/api/projects/${p.id}/generated`, { kind: 'gradient', color: '#ff0000', color2: '#0000ff', angle: 90, width: 640, height: 360, name: 'Pôr do sol' });
    expect(res.status).toBe(201);
    expect(res.body.media).toMatchObject({ width: 640, height: 360, name: 'Pôr do sol.png' });
  });

  it('cria uma forma quadrada transparente com nome em português', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const res = await u.post(`/api/projects/${p.id}/generated`, { kind: 'shape', shape: 'star', color: '#ffcc00', width: 512 });
    expect(res.status).toBe(201);
    expect(res.body.media).toMatchObject({ kind: 'image', width: 512, height: 512, name: 'Estrela FFCC00.png' });
    await t.built.ctx.queue.onIdle();
    const media = (await u.get(`/api/media/${res.body.media.id}`)).body.media;
    expect(media.status).toBe('ready');
  });

  it('forma exige a escolha da figura e recusa figura desconhecida', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    expect((await u.post(`/api/projects/${p.id}/generated`, { kind: 'shape', color: '#ffcc00' })).status).toBe(400);
    expect((await u.post(`/api/projects/${p.id}/generated`, { kind: 'shape', shape: 'hexagono', color: '#ffcc00' })).status).toBe(400);
  });

  it('valida cores, dimensões e a posse do projeto', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    expect((await a.post(`/api/projects/${p.id}/generated`, { kind: 'solid', color: 'vermelho' })).status).toBe(400);
    expect((await a.post(`/api/projects/${p.id}/generated`, { kind: 'gradient', color: '#000000' })).status).toBe(400);
    expect((await a.post(`/api/projects/${p.id}/generated`, { kind: 'solid', color: '#000000', width: 99999 })).status).toBe(400);
    expect((await b.post(`/api/projects/${p.id}/generated`, { kind: 'solid', color: '#000000' })).status).toBe(404);
  });
});
