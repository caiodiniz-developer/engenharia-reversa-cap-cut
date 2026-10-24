import { mkdir } from 'node:fs/promises';
import type { Server } from 'node:http';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { AiService } from './ai/service';
import { loadConfig, type Config } from './config';
import { EventBus } from './events';
import { HttpError, type AppContext } from './http';
import { registerJobs, runRetention } from './jobs';
import { JobQueue } from './queue';
import { aiRoutes } from './routes/ai';
import { authRoutes } from './routes/auth';
import { exportRoutes } from './routes/exports';
import { mediaRoutes } from './routes/media';
import { projectRoutes } from './routes/projects';
import { LocalObjectStore, type ObjectStore } from './storage';
import { attachWebSocket } from './ws';

export interface BuiltApp {
  app: Express;
  ctx: AppContext;
  attach(server: Server): void;
  close(): Promise<void>;
}

export interface BuildOptions {
  config?: Partial<Parameters<typeof loadConfig>[0]>;
  db?: PrismaClient;
  store?: ObjectStore;
  ai?: AiService;
}

export async function buildApp(opts: BuildOptions = {}): Promise<BuiltApp> {
  const config: Config = loadConfig(opts.config);
  const db = opts.db ?? new PrismaClient({ datasources: config.DATABASE_URL ? { db: { url: config.DATABASE_URL } } : undefined });
  const store = opts.store ?? new LocalObjectStore(config.STORAGE_DIR);
  const events = new EventBus();
  const queue = new JobQueue(db, events, {
    maxAttempts: config.JOB_MAX_ATTEMPTS,
    lanes: { export: config.EXPORT_CONCURRENCY, processing: config.PROCESSING_CONCURRENCY, ai: 2 },
  });
  const ai = opts.ai ?? new AiService(config);
  const ctx: AppContext = { config, db, store, queue, events, ai };
  registerJobs(ctx);
  await mkdir(config.tmpDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      allowedHeaders: ['Authorization', 'Content-Type', 'Upload-Offset', 'Range'],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
    }),
  );
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: config.RATE_LIMIT_PER_MINUTE, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Muitas requisições', code: 'rate_limited' } }),
  );
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', express.json({ limit: '100kb' }), authRoutes(ctx));
  // Projetos carregam o documento inteiro da timeline: limite maior que o padrão.
  app.use('/api/projects', express.json({ limit: '25mb' }), projectRoutes(ctx));
  app.use('/api', express.json({ limit: '1mb' }), mediaRoutes(ctx), exportRoutes(ctx), aiRoutes(ctx));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada', 'not_found')));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    } else if ((err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'Corpo da requisição grande demais', code: 'too_large' });
    } else if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON inválido', code: 'bad_json' });
    } else {
      console.error('[erro]', err);
      res.status(500).json({ error: 'Erro interno', code: 'internal' });
    }
  };
  app.use(onError);

  let interval: NodeJS.Timeout | undefined;
  let closeWs: (() => void) | undefined;
  return {
    app,
    ctx,
    attach(server) {
      closeWs = attachWebSocket(server, ctx);
      void queue.recover();
      interval = setInterval(() => void runRetention(ctx).catch((e) => console.error('[retenção]', e)), 3600_000);
      interval.unref();
    },
    async close() {
      if (interval) clearInterval(interval);
      closeWs?.();
      await queue.stop();
      if (!opts.db) await db.$disconnect();
    },
  };
}
