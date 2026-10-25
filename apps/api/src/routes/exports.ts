import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { z } from 'zod';
import { migrateProject, projectDuration } from '@editor/core';
import { HttpError, h, json, notFound, ownedProject, parse, requireAuth, type AppContext } from '../http';
import { contentDisposition, sanitizeFilename, signResource, verifyResource } from '../security';

const MAX_PIXELS = 3840 * 2160;
const MAX_CLIPS = 3000;

const ExportOptions = z.object({
  width: z.number().int().min(16).max(7680).optional(),
  height: z.number().int().min(16).max(7680).optional(),
  fps: z.number().min(1).max(60).optional(),
  codec: z.enum(['h264', 'h265', 'vp9']).default('h264'),
  /** Exporta somente o áudio mixado, neste formato. */
  audioOnly: z.enum(['mp3', 'wav', 'm4a']).optional(),
  /** 0 = melhor qualidade, 51 = pior. */
  crf: z.number().int().min(14).max(40).default(21),
  preset: z.enum(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']).default('veryfast'),
  range: z.object({ start: z.number().min(0), end: z.number().positive() }).refine((r) => r.end > r.start, 'Intervalo inválido').optional(),
});

const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

function presentJob(job: { id: string; type: string; status: string; progress: number; error: string | null; result: unknown; createdAt: Date; startedAt: Date | null; finishedAt: Date | null }) {
  return { id: job.id, type: job.type, status: job.status, progress: job.progress, error: job.error, result: job.result, createdAt: job.createdAt, startedAt: job.startedAt, finishedAt: job.finishedAt };
}

export function exportRoutes(ctx: AppContext): Router {
  const r = Router();
  const auth = requireAuth(ctx.config);

  r.post(
    '/projects/:id/exports',
    auth,
    h(async (req, res) => {
      const opts = parse(ExportOptions, req.body ?? {});
      const project = await ownedProject(ctx, req.params.id!, req.userId);
      const doc = migrateProject(project.data);
      const w = opts.width ?? doc.settings.width;
      const hgt = opts.height ?? doc.settings.height;
      if (w * hgt > MAX_PIXELS) throw new HttpError(422, 'Resolução acima do máximo suportado (4K UHD)', 'too_big');
      const duration = projectDuration(doc);
      if (duration <= 0) throw new HttpError(422, 'O projeto está vazio: adicione clipes antes de exportar', 'empty_project');
      if (duration > ctx.config.MAX_MEDIA_SECONDS) throw new HttpError(422, 'Duração acima do limite de exportação', 'too_long');
      if (doc.tracks.reduce((n, t) => n + t.clips.length, 0) > MAX_CLIPS) throw new HttpError(422, 'Projeto com clipes demais para exportar', 'too_complex');
      const notReady = await ctx.db.media.count({ where: { projectId: project.id, id: { in: Object.keys(doc.media) }, NOT: { status: 'ready' } } });
      if (notReady) throw new HttpError(409, 'Há mídias ainda em processamento', 'media_not_ready');

      // O servidor renderiza o documento salvo (fonte da verdade), nunca comandos ou dados do navegador.
      const snapshot = JSON.parse(JSON.stringify(doc));
      const job = await ctx.db.job.create({ data: { type: 'export', ownerId: req.userId, projectId: project.id, payload: {} } });
      const exp = await ctx.db.export.create({ data: { projectId: project.id, ownerId: req.userId, jobId: job.id, options: opts } });
      await ctx.db.job.update({ where: { id: job.id }, data: { status: 'queued', payload: { exportId: exp.id, project: snapshot, options: opts } } });
      // A fila só enxerga o job depois do enqueue: reaproveitamos o registro criado acima.
      await ctx.queue.adopt(job.id);
      res.status(202).json({ exportId: exp.id, jobId: job.id });
    }),
  );

  r.get(
    '/projects/:id/exports',
    auth,
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      const rows = await ctx.db.export.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { job: true } });
      res.json(json({ exports: rows.map((e) => ({ id: e.id, options: e.options, ready: !!e.outputKey, sizeBytes: e.sizeBytes, expiresAt: e.expiresAt, createdAt: e.createdAt, job: presentJob(e.job) })) }));
    }),
  );

  r.get(
    '/exports/:id',
    auth,
    h(async (req, res) => {
      const e = await ctx.db.export.findFirst({ where: { id: req.params.id, ownerId: req.userId }, include: { job: true } });
      if (!e) throw notFound('Exportação');
      res.json(json({ id: e.id, options: e.options, ready: !!e.outputKey, sizeBytes: e.sizeBytes, expiresAt: e.expiresAt, job: presentJob(e.job) }));
    }),
  );

  r.post(
    '/exports/:id/cancel',
    auth,
    h(async (req, res) => {
      const e = await ctx.db.export.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
      if (!e) throw notFound('Exportação');
      const ok = await ctx.queue.cancel(e.jobId);
      if (!ok) throw new HttpError(409, 'A exportação já terminou', 'not_cancellable');
      res.status(202).json({ cancelled: true });
    }),
  );

  r.get(
    '/exports/:id/download-url',
    auth,
    h(async (req, res) => {
      const e = await ctx.db.export.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
      if (!e) throw notFound('Exportação');
      if (!e.outputKey) throw new HttpError(409, 'O arquivo não está disponível (em andamento, falhou ou expirou)', 'not_ready');
      const { exp, sig } = signResource(ctx.config.signingSecret, `export:${e.id}`, req.userId, ctx.config.SIGNED_URL_TTL_SECONDS);
      res.json({ url: `${ctx.config.PUBLIC_API_URL}/api/exports/${e.id}/file?u=${encodeURIComponent(req.userId)}&exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000).toISOString() });
    }),
  );

  // Download por link assinado (sem cabeçalho Authorization, para o navegador baixar direto).
  r.get(
    '/exports/:id/file',
    h(async (req, res) => {
      const userId = String(req.query.u ?? '');
      if (!verifyResource(ctx.config.signingSecret, `export:${req.params.id}`, userId, Number(req.query.exp), String(req.query.sig ?? ''))) {
        throw new HttpError(403, 'Link inválido ou expirado', 'bad_signature');
      }
      const e = await ctx.db.export.findFirst({ where: { id: req.params.id, ownerId: userId }, include: { project: { select: { name: true } } } });
      if (!e?.outputKey) throw notFound('Arquivo');
      const size = await ctx.store.size(e.outputKey);
      if (size === undefined) throw notFound('Arquivo');
      const ext = path.extname(e.outputKey);
      res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
      res.setHeader('Content-Length', size);
      res.setHeader('Content-Disposition', contentDisposition(`${sanitizeFilename(e.project.name)}${ext}`));
      await pipeline(ctx.store.stream(e.outputKey), res);
    }),
  );

  r.get(
    '/jobs/:id',
    auth,
    h(async (req, res) => {
      const job = await ctx.db.job.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
      if (!job) throw notFound('Tarefa');
      res.json(json(presentJob(job)));
    }),
  );

  r.post(
    '/jobs/:id/cancel',
    auth,
    h(async (req, res) => {
      const job = await ctx.db.job.findFirst({ where: { id: req.params.id, ownerId: req.userId } });
      if (!job) throw notFound('Tarefa');
      if (!(await ctx.queue.cancel(job.id))) throw new HttpError(409, 'A tarefa já terminou', 'not_cancellable');
      res.status(202).json({ cancelled: true });
    }),
  );

  r.get(
    '/jobs',
    auth,
    h(async (req, res) => {
      const jobs = await ctx.db.job.findMany({ where: { ownerId: req.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
      res.json(json({ jobs: jobs.map(presentJob) }));
    }),
  );

  return r;
}
