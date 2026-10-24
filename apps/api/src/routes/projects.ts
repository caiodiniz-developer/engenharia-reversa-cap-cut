import { Router } from 'express';
import { z } from 'zod';
import { createProject, migrateProject, ProjectSettingsSchema, SCHEMA_VERSION, type Project } from '@editor/core';
import { HttpError, h, json, notFound, ownedProject, parse, requireAuth, type AppContext } from '../http';

const Create = z.object({
  name: z.string().trim().min(1).max(120).default('Projeto sem título'),
  settings: ProjectSettingsSchema.partial().optional(),
});

const Save = z.object({
  data: z.unknown(),
  /** Revisão em que o cliente baseou a edição; se divergir do servidor, a gravação é recusada (409). */
  baseRevision: z.number().int().min(1),
  name: z.string().trim().min(1).max(120).optional(),
});

const SnapshotBody = z.object({ label: z.string().trim().max(100).default('') });

const AUTO_SNAPSHOT_EVERY = 10;
const MAX_VERSIONS = 50;

/** Valida o documento e confere que toda mídia referenciada pertence ao projeto. */
async function validateDocument(ctx: AppContext, projectId: string, raw: unknown): Promise<Project> {
  let doc: Project;
  try {
    doc = migrateProject(raw);
  } catch (e) {
    throw new HttpError(422, `Documento de projeto inválido: ${e instanceof Error ? e.message.slice(0, 300) : 'erro'}`, 'invalid_project');
  }
  const ids = Object.keys(doc.media);
  if (ids.length) {
    const found = await ctx.db.media.findMany({ where: { id: { in: ids }, projectId }, select: { id: true } });
    const ok = new Set(found.map((m) => m.id));
    const missing = ids.filter((i) => !ok.has(i));
    if (missing.length) throw new HttpError(422, 'O projeto referencia mídias que não pertencem a ele', 'invalid_media', { missing });
  }
  for (const t of doc.tracks)
    for (const c of t.clips)
      if (c.type === 'media' && !doc.media[c.mediaId]) throw new HttpError(422, `Clipe referencia mídia ausente: ${c.mediaId}`, 'invalid_project');
  return doc;
}

export function projectRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth(ctx.config));

  r.get(
    '/',
    h(async (req, res) => {
      const rows = await ctx.db.project.findMany({
        where: { ownerId: req.userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, revision: true, updatedAt: true, createdAt: true },
        take: 200,
      });
      res.json({ projects: rows });
    }),
  );

  r.post(
    '/',
    h(async (req, res) => {
      const body = parse(Create, req.body ?? {});
      const doc = createProject(body.name, body.settings);
      const row = await ctx.db.project.create({
        data: { id: doc.id, ownerId: req.userId, name: body.name, data: doc as object, schemaVersion: SCHEMA_VERSION },
      });
      res.status(201).json({ project: { id: row.id, name: row.name, revision: row.revision, data: doc } });
    }),
  );

  r.get(
    '/:id',
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      // A leitura migra documentos antigos para a versão atual do schema.
      const data = migrateProject(p.data);
      res.json({ project: { id: p.id, name: p.name, revision: p.revision, updatedAt: p.updatedAt, data } });
    }),
  );

  r.put(
    '/:id',
    h(async (req, res) => {
      const body = parse(Save, req.body);
      const existing = await ownedProject(ctx, req.params.id!, req.userId);
      const doc = await validateDocument(ctx, existing.id, body.data);
      const name = body.name ?? doc.name;
      const next = body.baseRevision + 1;
      // Atualização condicional: só grava se ninguém salvou depois da revisão-base.
      const res1 = await ctx.db.project.updateMany({
        where: { id: existing.id, ownerId: req.userId, revision: body.baseRevision },
        data: { data: { ...doc, name } as object, name, schemaVersion: SCHEMA_VERSION, revision: next },
      });
      if (res1.count === 0) {
        const cur = await ctx.db.project.findUnique({ where: { id: existing.id }, select: { revision: true } });
        throw new HttpError(409, 'O projeto foi alterado em outra sessão', 'revision_conflict', { currentRevision: cur?.revision });
      }
      if (next % AUTO_SNAPSHOT_EVERY === 0) await snapshot(ctx, existing.id, next, doc, 'Salvamento automático');
      res.json({ revision: next });
    }),
  );

  r.delete(
    '/:id',
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      await ctx.db.project.delete({ where: { id: p.id } });
      await ctx.store.deletePrefix(`projects/${p.id}`);
      res.status(204).end();
    }),
  );

  // ---- Histórico de versões ----
  r.get(
    '/:id/versions',
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      const versions = await ctx.db.projectVersion.findMany({
        where: { projectId: p.id },
        orderBy: { revision: 'desc' },
        select: { id: true, revision: true, label: true, createdAt: true },
      });
      res.json({ versions });
    }),
  );

  r.post(
    '/:id/versions',
    h(async (req, res) => {
      const body = parse(SnapshotBody, req.body ?? {});
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      await snapshot(ctx, p.id, p.revision, migrateProject(p.data), body.label || 'Versão salva manualmente');
      res.status(201).json({ revision: p.revision });
    }),
  );

  r.post(
    '/:id/versions/:revision/restore',
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      const rev = Number(req.params.revision);
      const v = Number.isInteger(rev) ? await ctx.db.projectVersion.findUnique({ where: { projectId_revision: { projectId: p.id, revision: rev } } }) : null;
      if (!v) throw notFound('Versão');
      // Guarda o estado atual antes de restaurar, para que a restauração seja reversível.
      await snapshot(ctx, p.id, p.revision, migrateProject(p.data), `Antes de restaurar a revisão ${rev}`);
      const doc = await validateDocument(ctx, p.id, v.data);
      const next = p.revision + 1;
      await ctx.db.project.update({ where: { id: p.id }, data: { data: doc as object, name: doc.name, revision: next } });
      res.json(json({ revision: next, data: doc }));
    }),
  );

  return r;
}

async function snapshot(ctx: AppContext, projectId: string, revision: number, doc: Project, label: string): Promise<void> {
  await ctx.db.projectVersion.upsert({
    where: { projectId_revision: { projectId, revision } },
    create: { projectId, revision, label, data: doc as object },
    update: { label, data: doc as object },
  });
  const old = await ctx.db.projectVersion.findMany({ where: { projectId }, orderBy: { revision: 'desc' }, skip: MAX_VERSIONS, select: { id: true } });
  if (old.length) await ctx.db.projectVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}
