import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import type { Config } from './config';
import type { EventBus } from './events';
import type { JobQueue } from './queue';
import type { ObjectStore } from './storage';
import type { AiService } from './ai/service';
import { verifyToken } from './security';

export interface AppContext {
  config: Config;
  db: PrismaClient;
  store: ObjectStore;
  queue: JobQueue;
  events: EventBus;
  ai: AiService;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'error',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso'): HttpError => new HttpError(404, `${what} não encontrado`, 'not_found');

export type AuthedRequest = Request & { userId: string };

/** Envolve handlers async para que rejeições cheguem ao middleware de erro. */
export const h =
  (fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req as AuthedRequest, res, next).catch(next);
  };

export function requireAuth(config: Config): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? verifyToken(token, config.jwtSecret) : undefined;
    if (!claims) return next(new HttpError(401, 'Não autenticado', 'unauthenticated'));
    (req as AuthedRequest).userId = claims.sub;
    next();
  };
}

/** Valida e tipa uma parte da requisição com Zod (erro 400 com detalhes por campo). */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(400, 'Requisição inválida', 'validation', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

/** Carrega o projeto garantindo que pertence ao usuário (404 se não existir ou não for dele). */
export async function ownedProject(ctx: AppContext, projectId: string, userId: string) {
  const p = await ctx.db.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!p) throw notFound('Projeto');
  return p;
}

export async function ownedMedia(ctx: AppContext, mediaId: string, userId: string) {
  const m = await ctx.db.media.findFirst({ where: { id: mediaId, ownerId: userId } });
  if (!m) throw notFound('Mídia');
  return m;
}

/** Serializa BigInt (tamanhos) para JSON. */
export function json<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
}
