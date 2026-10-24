import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildApp } from './app';
import { startEmbeddedPostgres } from './devdb';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

/**
 * `pnpm dev:api` — ambiente de desenvolvimento completo e persistente: PostgreSQL embarcado, schema do
 * Prisma aplicado e a API. Dados em PGDATA_DIR (padrão ./.pgdata) e STORAGE_DIR (padrão ./storage).
 * Se DATABASE_URL já estiver definido, usa esse banco e não sobe o PostgreSQL embarcado.
 */
let stopDb: (() => Promise<void>) | undefined;
let url = process.env.DATABASE_URL;
if (!url) {
  const db = await startEmbeddedPostgres({ dir: process.env.PGDATA_DIR ?? path.resolve('.pgdata'), port: Number(process.env.PGPORT ?? 54329) });
  url = db.url;
  stopDb = db.stop;
  console.log(`PostgreSQL embarcado em ${url}`);
}
process.env.DATABASE_URL = url;
await execFileAsync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], { cwd: path.resolve(import.meta.dirname, '..'), env: process.env });

const built = await buildApp({
  config: {
    DATABASE_URL: url,
    // Em desenvolvimento o navegador fala com o Vite (porta 5173), que faz proxy para a API.
    PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? 'http://localhost:5173',
  },
});
const server = createServer(built.app);
built.attach(server);
server.listen(built.ctx.config.PORT, () => console.log(`API em http://localhost:${built.ctx.config.PORT}`));

const shutdown = async () => {
  server.close();
  await built.close();
  await stopDb?.();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
