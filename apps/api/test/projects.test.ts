import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addTrack } from '@editor/core';
import { registerUser, startTestApp, toPath, type TestApp } from './harness';
import { assetOf, createProjectFor, makeVideo, sequenceDoc, uploadMedia } from './fixtures';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(() => t.close());

describe('projetos', () => {
  it('cria, lista, lê, renomeia e exclui', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u, 'Meu filme');
    expect(p.data.version).toBe(1);
    const list = await u.get('/api/projects');
    expect(list.body.projects.map((x: { id: string }) => x.id)).toContain(p.id);

    const doc = addTrack(p.data, 'video').project;
    const saved = await u.put(`/api/projects/${p.id}`, { data: doc, baseRevision: p.revision, name: 'Renomeado' });
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(2);

    const read = await u.get(`/api/projects/${p.id}`);
    expect(read.body.project.name).toBe('Renomeado');
    expect(read.body.project.data.tracks).toHaveLength(1);

    expect((await u.del(`/api/projects/${p.id}`)).status).toBe(204);
    expect((await u.get(`/api/projects/${p.id}`)).status).toBe(404);
  });

  it('isola projetos entre usuários (404 para quem não é dono)', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    expect((await b.get(`/api/projects/${p.id}`)).status).toBe(404);
    expect((await b.put(`/api/projects/${p.id}`, { data: p.data, baseRevision: 1 })).status).toBe(404);
    expect((await b.del(`/api/projects/${p.id}`)).status).toBe(404);
    expect((await b.get('/api/projects')).body.projects).toHaveLength(0);
    expect((await b.get(`/api/projects/${p.id}/versions`)).status).toBe(404);
  });

  it('detecta salvamento concorrente (409) e informa a revisão atual', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    expect((await u.put(`/api/projects/${p.id}`, { data: p.data, baseRevision: 1 })).status).toBe(200);
    const stale = await u.put(`/api/projects/${p.id}`, { data: p.data, baseRevision: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('revision_conflict');
    expect(stale.body.details.currentRevision).toBe(2);
  });

  it('rejeita documentos inválidos (422) e corpo malformado (400)', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    const bad = await u.put(`/api/projects/${p.id}`, { data: { version: 1, id: 'x' }, baseRevision: 1 });
    expect(bad.status).toBe(422);
    expect((await u.put(`/api/projects/${p.id}`, { baseRevision: 'x' })).status).toBe(400);
    const future = await u.put(`/api/projects/${p.id}`, { data: { ...p.data, version: 99 }, baseRevision: 1 });
    expect(future.status).toBe(422);
    const broken = await t.http.put(`/api/projects/${p.id}`).set(u.auth).set('Content-Type', 'application/json').send('{oops');
    expect(broken.status).toBe(400);
  });

  it('só aceita mídias que pertencem ao projeto', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const pa = await createProjectFor(a);
    const pb = await createProjectFor(b);
    const file = await makeVideo(t.dir, 'a.mp4', { duration: 1, color: 'ff0000' });
    const m = await uploadMedia(t, a, pa.id, file);
    // O usuário B tenta referenciar a mídia do usuário A no próprio projeto.
    const stolen = sequenceDoc(pb.data, [{ asset: assetOf(m), duration: 1 }]);
    const res = await b.put(`/api/projects/${pb.id}`, { data: stolen, baseRevision: 1 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('invalid_media');
    // O dono consegue salvar com a própria mídia.
    const ok = await a.put(`/api/projects/${pa.id}`, { data: sequenceDoc(pa.data, [{ asset: assetOf(m), duration: 1 }]), baseRevision: 1 });
    expect(ok.status).toBe(200);
  });

  it('histórico: snapshot manual, listagem e restauração reversível', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u, 'Versões');
    await u.put(`/api/projects/${p.id}`, { data: p.data, baseRevision: 1, name: 'v2' });
    expect((await u.post(`/api/projects/${p.id}/versions`, { label: 'marco' })).status).toBe(201);
    const withTrack = addTrack({ ...p.data, name: 'v3' }, 'video').project;
    await u.put(`/api/projects/${p.id}`, { data: withTrack, baseRevision: 2 });
    const versions = await u.get(`/api/projects/${p.id}/versions`);
    expect(versions.body.versions.map((v: { label: string }) => v.label)).toContain('marco');

    const restore = await u.post(`/api/projects/${p.id}/versions/2/restore`);
    expect(restore.status).toBe(200);
    expect(restore.body.data.tracks).toHaveLength(0);
    const after = await u.get(`/api/projects/${p.id}`);
    expect(after.body.project.revision).toBe(4);
    // O estado anterior à restauração foi guardado e pode ser recuperado.
    const labels = (await u.get(`/api/projects/${p.id}/versions`)).body.versions.map((v: { label: string }) => v.label);
    expect(labels.some((l: string) => l.startsWith('Antes de restaurar'))).toBe(true);
    expect((await u.post(`/api/projects/${p.id}/versions/99/restore`)).status).toBe(404);
  });

  it('cria snapshot automático a cada 10 revisões', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u);
    for (let rev = 1; rev < 10; rev++) {
      const r = await u.put(`/api/projects/${p.id}`, { data: p.data, baseRevision: rev });
      expect(r.status).toBe(200);
    }
    const versions = (await u.get(`/api/projects/${p.id}/versions`)).body.versions;
    expect(versions.map((v: { revision: number }) => v.revision)).toEqual([10]);
  });
});

describe('listagem, capa e duplicação', () => {
  it('a listagem traz resumo (duração, formato, clipes) e a capa da primeira mídia', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u, 'Com capa');
    let list = (await u.get('/api/projects')).body.projects;
    expect(list[0]).toMatchObject({ id: p.id, cover: null, meta: { duration: 0, clips: 0, width: 1920, height: 1080 } });

    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'capa.mp4', { duration: 2, color: 'ff0000' }));
    await u.put(`/api/projects/${p.id}`, { data: sequenceDoc(p.data, [{ asset: assetOf(m), duration: 2 }]), baseRevision: 1 });
    list = (await u.get('/api/projects')).body.projects;
    expect(list[0].meta).toMatchObject({ duration: 2, clips: 1, tracks: 1 });
    expect(list[0].cover).toContain('/thumb?');
    expect((await t.http.get(toPath(list[0].cover))).status).toBe(200);
  });

  it('duplicar copia documento e mídias com ids novos, e a cópia independe do original', async () => {
    const u = await registerUser(t);
    const p = await createProjectFor(u, 'Original');
    const m = await uploadMedia(t, u, p.id, await makeVideo(t.dir, 'dup.mp4', { duration: 2, color: '00aa00', tone: 440 }));
    await u.put(`/api/projects/${p.id}`, { data: sequenceDoc(p.data, [{ asset: assetOf(m), duration: 2 }]), baseRevision: 1 });

    const dup = await u.post(`/api/projects/${p.id}/duplicate`);
    expect(dup.status).toBe(201);
    expect(dup.body.project.name).toBe('Original (cópia)');
    const copyId = dup.body.project.id as string;
    expect(copyId).not.toBe(p.id);

    const copyMedia = (await u.get(`/api/projects/${copyId}/media`)).body.media;
    expect(copyMedia).toHaveLength(1);
    expect(copyMedia[0].id).not.toBe(m.id);
    const doc = (await u.get(`/api/projects/${copyId}`)).body.project.data;
    expect(Object.keys(doc.media)).toEqual([copyMedia[0].id]);
    expect(doc.tracks[0].clips[0].mediaId).toBe(copyMedia[0].id);
    expect(doc.id).toBe(copyId);

    // exclui o original: a cópia continua com todos os arquivos
    expect((await u.del(`/api/projects/${p.id}`)).status).toBe(204);
    expect((await t.http.get(toPath(copyMedia[0].urls.original))).status).toBe(200);
    expect((await t.http.get(toPath(copyMedia[0].urls.thumb))).status).toBe(200);
    expect((await t.http.get(toPath(copyMedia[0].urls.film))).status).toBe(200);

    // e a cópia exporta normalmente
    const exp = await u.post(`/api/projects/${copyId}/exports`, { preset: 'ultrafast', width: 320, height: 180 });
    expect(exp.status).toBe(202);
    await t.built.ctx.queue.onIdle();
    expect((await u.get(`/api/exports/${exp.body.exportId}`)).body.job.status).toBe('succeeded');
  });

  it('nome personalizado; outro usuário não duplica', async () => {
    const a = await registerUser(t);
    const b = await registerUser(t);
    const p = await createProjectFor(a);
    const dup = await a.post(`/api/projects/${p.id}/duplicate`, { name: 'Minha cópia' });
    expect(dup.body.project.name).toBe('Minha cópia');
    expect((await b.post(`/api/projects/${p.id}/duplicate`)).status).toBe(404);
  });
});
