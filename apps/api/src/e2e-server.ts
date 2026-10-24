import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildApp } from './app';
import { startEmbeddedPostgres } from './devdb';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Servidor completo e descartável para testes ponta a ponta: PostgreSQL próprio (porta livre), schema
 * aplicado, armazenamento em diretório temporário e a API no PORT informado.
 */
const root = await mkdtemp(path.join(os.tmpdir(), 'editor-e2e-'));
const db = await startEmbeddedPostgres({ dir: path.join(root, 'pg'), port: await freePort() });
await execFileAsync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: { ...process.env, DATABASE_URL: db.url },
});

// Antes de montar a app: as rotas leem o diretório temporário da configuração ao serem criadas.
process.env.TEMP_DIR = path.join(root, 'tmp');
const port = Number(process.env.PORT ?? 3101);
const web = process.env.WEB_ORIGIN ?? 'http://localhost:5273';
const built = await buildApp({
  config: {
    NODE_ENV: 'test',
    PORT: port,
    DATABASE_URL: db.url,
    JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
    STORAGE_DIR: path.join(root, 'storage'),
    CORS_ORIGINS: web,
    PUBLIC_API_URL: web,
    RATE_LIMIT_PER_MINUTE: 100000,
    AUTH_RATE_LIMIT_PER_MINUTE: 100000,
  },
});
const server = createServer(built.app);
built.attach(server);
server.listen(port, () => console.log(`E2E API em http://localhost:${port}`));

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  await built.close().catch(() => {});
  await db.stop().catch(() => {});
  await rm(root, { recursive: true, force: true }).catch(() => {});
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
