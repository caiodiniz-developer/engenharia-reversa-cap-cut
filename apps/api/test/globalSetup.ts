import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GlobalSetupContext } from 'vitest/node';
import { startEmbeddedPostgres } from '../src/devdb';

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

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Sobe um PostgreSQL real e aplica o schema do Prisma uma única vez para toda a suíte. */
export default async function setup({ provide }: GlobalSetupContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'editor-pg-'));
  const db = await startEmbeddedPostgres({ dir, port: await freePort() });
  const prismaCli = require.resolve('prisma/build/index.js');
  await execFileAsync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: db.url },
  });
  provide('databaseUrl', db.url);
  return async () => {
    await db.stop();
    await rm(dir, { recursive: true, force: true });
  };
}
