import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import { Router } from 'express';
import type { Media } from '@prisma/client';
import { z } from 'zod';
import { probeMedia } from '@editor/render';
import { HttpError, h, json, notFound, ownedMedia, ownedProject, parse, requireAuth, type AppContext } from '../http';
import { sanitizeFilename, signResource, verifyResource } from '../security';

const CHUNK_SIZE = 8 * 1024 * 1024;
const VARIANTS = ['original', 'proxy', 'thumb', 'waveform'] as const;
type Variant = (typeof VARIANTS)[number];

const InitUpload = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime: z.string().max(100).default('application/octet-stream'),
});

interface UploadMeta {
  userId: string;
  projectId: string;
  filename: string;
  size: number;
  mime: string;
}

const MIME_OK = /^(video|audio|image)\//;

export function mediaUrl(ctx: AppContext, mediaId: string, variant: Variant, userId: string): string {
  const { exp, sig } = signResource(ctx.config.signingSecret, `media:${mediaId}:${variant}`, userId, ctx.config.SIGNED_URL_TTL_SECONDS);
  return `${ctx.config.PUBLIC_API_URL}/api/files/${mediaId}/${variant}?u=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}`;
}

function keyFor(m: Media, variant: Variant): string | null {
  switch (variant) {
    case 'original':
      return m.storageKey;
    case 'proxy':
      return m.proxyKey;
    case 'thumb':
      return m.thumbKey;
    case 'waveform':
      return m.waveformKey;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

export function presentMedia(ctx: AppContext, m: Media, userId: string) {
  return json({
    id: m.id,
    name: m.originalName,
    kind: m.kind,
    duration: m.duration,
    width: m.width,
    height: m.height,
    fps: m.fps,
    hasAudio: m.hasAudio,
    size: m.size,
    mime: m.mime,
    status: m.status,
    error: m.error,
    urls: {
      original: mediaUrl(ctx, m.id, 'original', userId),
      proxy: m.proxyKey ? mediaUrl(ctx, m.id, 'proxy', userId) : null,
      thumb: m.thumbKey ? mediaUrl(ctx, m.id, 'thumb', userId) : null,
      waveform: m.waveformKey ? mediaUrl(ctx, m.id, 'waveform', userId) : null,
    },
  });
}

export function mediaRoutes(ctx: AppContext): Router {
  const r = Router();
  const auth = requireAuth(ctx.config);
  const uploadsDir = path.join(ctx.config.tmpDir, 'uploads');

  async function readMeta(uploadId: string): Promise<UploadMeta> {
    if (!/^[a-f0-9]{32}$/.test(uploadId)) throw notFound('Upload');
    try {
      return JSON.parse(await readFile(path.join(uploadsDir, uploadId, 'meta.json'), 'utf8')) as UploadMeta;
    } catch {
      throw notFound('Upload');
    }
  }

  async function ownedUpload(uploadId: string, userId: string): Promise<UploadMeta> {
    const meta = await readMeta(uploadId);
    if (meta.userId !== userId) throw notFound('Upload');
    return meta;
  }

  async function assertQuota(projectId: string): Promise<void> {
    const count = await ctx.db.media.count({ where: { projectId } });
    if (count >= ctx.config.MAX_PROJECT_MEDIA) throw new HttpError(409, `Limite de ${ctx.config.MAX_PROJECT_MEDIA} mídias por projeto`, 'quota');
  }

  /** Valida o arquivo (ffprobe), guarda no armazenamento, cria o registro e agenda o processamento. */
  async function finalize(userId: string, projectId: string, file: string, filename: string, mime: string) {
    const safeName = sanitizeFilename(filename);
    let info;
    try {
      info = await probeMedia(file);
    } catch {
      throw new HttpError(415, 'O arquivo não é uma mídia válida (vídeo, áudio ou imagem)', 'invalid_media');
    }
    if (info.duration > ctx.config.MAX_MEDIA_SECONDS) {
      throw new HttpError(413, `Duração acima do limite de ${Math.round(ctx.config.MAX_MEDIA_SECONDS / 60)} minutos`, 'too_long');
    }
    const row = await ctx.db.media.create({
      data: {
        projectId,
        ownerId: userId,
        originalName: safeName,
        mime,
        size: BigInt(info.size),
        kind: info.kind,
        duration: info.duration,
        width: info.width,
        height: info.height,
        fps: info.fps,
        hasAudio: info.hasAudio,
        storageKey: 'pending',
        status: 'processing',
      },
    });
    const ext = path.extname(safeName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
    const key = `projects/${projectId}/media/${row.id}/original${ext}`;
    await ctx.store.put(key, createReadStream(file));
    const media = await ctx.db.media.update({ where: { id: row.id }, data: { storageKey: key } });
    await ctx.queue.enqueue({ type: 'media.process', ownerId: userId, projectId, payload: { mediaId: media.id } });
    return media;
  }

  // ---- Upload resumível em partes ----
  r.post(
    '/projects/:id/uploads',
    auth,
    h(async (req, res) => {
      const body = parse(InitUpload, req.body);
      const project = await ownedProject(ctx, req.params.id!, req.userId);
      if (body.size > ctx.config.MAX_UPLOAD_BYTES) throw new HttpError(413, 'Arquivo acima do tamanho máximo permitido', 'too_large');
      if (!MIME_OK.test(body.mime)) throw new HttpError(415, 'Tipo de arquivo não suportado', 'unsupported_type');
      await assertQuota(project.id);
      const uploadId = randomBytes(16).toString('hex');
      const dir = path.join(uploadsDir, uploadId);
      await mkdir(dir, { recursive: true });
      const meta: UploadMeta = { userId: req.userId, projectId: project.id, filename: body.filename, size: body.size, mime: body.mime };
      await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta));
      await writeFile(path.join(dir, 'data.part'), '');
      res.status(201).json({ uploadId, chunkSize: CHUNK_SIZE });
    }),
  );

  r.get(
    '/uploads/:uploadId',
    auth,
    h(async (req, res) => {
      const meta = await ownedUpload(req.params.uploadId!, req.userId);
      const { size } = await stat(path.join(uploadsDir, req.params.uploadId!, 'data.part'));
      res.json({ offset: size, size: meta.size });
    }),
  );

  r.patch(
    '/uploads/:uploadId',
    auth,
    h(async (req, res) => {
      const meta = await ownedUpload(req.params.uploadId!, req.userId);
      const part = path.join(uploadsDir, req.params.uploadId!, 'data.part');
      const { size: current } = await stat(part);
      const offset = Number(req.headers['upload-offset']);
      if (!Number.isInteger(offset) || offset !== current) {
        throw new HttpError(409, 'Offset inconsistente; consulte o estado do upload e retome', 'offset_mismatch', { offset: current });
      }
      // Grava em streaming (sem acumular o corpo em memória), limitado ao tamanho declarado.
      let received = 0;
      const out = createWriteStream(part, { flags: 'a' });
      try {
        for await (const c of req) {
          const buf = c as Buffer;
          received += buf.length;
          if (current + received > meta.size) throw new HttpError(413, 'Dados além do tamanho declarado', 'too_large');
          if (!out.write(buf)) await once(out, 'drain');
        }
      } finally {
        await new Promise<void>((resolve) => out.end(resolve));
      }
      res.json({ offset: current + received });
    }),
  );

  r.post(
    '/uploads/:uploadId/complete',
    auth,
    h(async (req, res) => {
      const meta = await ownedUpload(req.params.uploadId!, req.userId);
      const dir = path.join(uploadsDir, req.params.uploadId!);
      const part = path.join(dir, 'data.part');
      const { size } = await stat(part);
      if (size !== meta.size) throw new HttpError(409, 'Upload incompleto', 'incomplete', { offset: size, size: meta.size });
      try {
        await ownedProject(ctx, meta.projectId, req.userId);
        const media = await finalize(req.userId, meta.projectId, part, meta.filename, meta.mime);
        res.status(201).json({ media: presentMedia(ctx, media, req.userId) });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }),
  );

  // ---- Upload simples (multipart) para arquivos pequenos ----
  r.post(
    '/projects/:id/media',
    auth,
    h(async (req, res) => {
      const project = await ownedProject(ctx, req.params.id!, req.userId);
      await assertQuota(project.id);
      await mkdir(path.join(ctx.config.tmpDir, 'multipart'), { recursive: true });
      const tmp = path.join(ctx.config.tmpDir, 'multipart', randomBytes(8).toString('hex'));
      let filename = '';
      let mime = '';
      let tooLarge = false;
      let wrote = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: ctx.config.MAX_UPLOAD_BYTES, fields: 5 } });
          const pending: Promise<void>[] = [];
          bb.on('file', (_name, stream, info) => {
            filename = info.filename;
            mime = info.mimeType;
            wrote = true;
            stream.on('limit', () => (tooLarge = true));
            pending.push(pipeline(stream, createWriteStream(tmp)));
          });
          bb.on('error', reject);
          bb.on('close', () => Promise.all(pending).then(() => resolve(), reject));
          req.pipe(bb);
        });
        if (!wrote) throw new HttpError(400, 'Nenhum arquivo enviado', 'no_file');
        if (tooLarge) throw new HttpError(413, 'Arquivo acima do tamanho máximo permitido', 'too_large');
        if (!MIME_OK.test(mime)) throw new HttpError(415, 'Tipo de arquivo não suportado', 'unsupported_type');
        const media = await finalize(req.userId, project.id, tmp, filename, mime);
        res.status(201).json({ media: presentMedia(ctx, media, req.userId) });
      } finally {
        await rm(tmp, { force: true });
      }
    }),
  );

  r.get(
    '/projects/:id/media',
    auth,
    h(async (req, res) => {
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      const take = Math.min(Number(req.query.limit) || 100, 200);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const rows = await ctx.db.media.findMany({
        where: { projectId: p.id },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = rows.slice(0, take);
      res.json({ media: page.map((m) => presentMedia(ctx, m, req.userId)), nextCursor: rows.length > take ? page[page.length - 1]!.id : null });
    }),
  );

  r.get(
    '/media/:id',
    auth,
    h(async (req, res) => {
      res.json({ media: presentMedia(ctx, await ownedMedia(ctx, req.params.id!, req.userId), req.userId) });
    }),
  );

  r.delete(
    '/media/:id',
    auth,
    h(async (req, res) => {
      const m = await ownedMedia(ctx, req.params.id!, req.userId);
      await ctx.db.media.delete({ where: { id: m.id } });
      await ctx.store.deletePrefix(`projects/${m.projectId}/media/${m.id}`);
      res.status(204).end();
    }),
  );

  // ---- Download/stream por URL assinada (permite <video src> sem cabeçalho Authorization) ----
  r.get(
    '/files/:mediaId/:variant',
    h(async (req, res) => {
      const variant = req.params.variant as Variant;
      const userId = String(req.query.u ?? '');
      const exp = Number(req.query.exp);
      const sig = String(req.query.sig ?? '');
      if (!VARIANTS.includes(variant)) throw notFound('Arquivo');
      if (!verifyResource(ctx.config.signingSecret, `media:${req.params.mediaId}:${variant}`, userId, exp, sig)) {
        throw new HttpError(403, 'Link inválido ou expirado', 'bad_signature');
      }
      const m = await ctx.db.media.findFirst({ where: { id: req.params.mediaId, ownerId: userId } });
      const key = m ? keyFor(m, variant) : null;
      if (!m || !key) throw notFound('Arquivo');
      const total = await ctx.store.size(key);
      if (total === undefined) throw notFound('Arquivo');
      const type = CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
      if (range && (range[1] || range[2])) {
        let start = range[1] ? Number(range[1]) : total - Number(range[2]);
        let end = range[1] && range[2] ? Number(range[2]) : total - 1;
        start = Math.max(0, start);
        end = Math.min(total - 1, end);
        if (start > end || start >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        await pipeline(ctx.store.stream(key, { start, end }), res);
        return;
      }
      res.setHeader('Content-Length', total);
      await pipeline(ctx.store.stream(key), res);
    }),
  );

  return r;
}
