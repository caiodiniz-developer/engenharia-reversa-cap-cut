import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import { inject } from 'vitest';
import { buildApp, type BuiltApp, type BuildOptions } from '../src/app';

export interface TestApp {
  built: BuiltApp;
  http: ReturnType<typeof supertest>;
  dir: string;
  close(): Promise<void>;
}

export async function startTestApp(opts: BuildOptions & { env?: Record<string, string | number> } = {}): Promise<TestApp> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'editor-api-test-'));
  const built = await buildApp({
    ...opts,
    config: {
      NODE_ENV: 'test',
      DATABASE_URL: inject('databaseUrl'),
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      STORAGE_DIR: path.join(dir, 'storage'),
      PUBLIC_API_URL: 'http://localhost',
      RATE_LIMIT_PER_MINUTE: 100000,
      AUTH_RATE_LIMIT_PER_MINUTE: 100000,
      ...(opts.env as object),
      ...opts.config,
    } as never,
  });
  built.ctx.config.tmpDir = path.join(dir, 'tmp');
  return {
    built,
    http: supertest(built.app),
    dir,
    async close() {
      await built.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

let counter = 0;

/** Cadastra um usuário novo e devolve o token + helper para chamadas autenticadas. */
export async function registerUser(t: TestApp, name = 'Fulano') {
  const email = `user${Date.now()}_${counter++}@example.com`;
  const res = await t.http.post('/api/auth/register').send({ email, password: 'senha-forte-123', name });
  if (res.status !== 201) throw new Error(`register falhou: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.token as string;
  const auth = { Authorization: `Bearer ${token}` };
  return {
    email,
    token,
    userId: res.body.user.id as string,
    auth,
    get: (url: string) => t.http.get(url).set(auth),
    post: (url: string, body?: object) => t.http.post(url).set(auth).send(body ?? {}),
    put: (url: string, body?: object) => t.http.put(url).set(auth).send(body ?? {}),
    patch: (url: string) => t.http.patch(url).set(auth),
    del: (url: string) => t.http.delete(url).set(auth),
  };
}

export type TestUser = Awaited<ReturnType<typeof registerUser>>;

/** Converte uma URL absoluta devolvida pela API em caminho para o supertest. */
export const toPath = (url: string): string => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};
