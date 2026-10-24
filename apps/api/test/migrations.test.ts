import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { startEmbeddedPostgres } from '../src/devdb';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const apiDir = path.resolve(import.meta.dirname, '..');

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });

describe('migrações de produção', () => {
  let dir: string;
  let stop: (() => Promise<void>) | undefined;
  afterAll(async () => {
    await stop?.();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('prisma migrate deploy cria o schema em um banco vazio e o app consegue usá-lo', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'editor-mig-'));
    const db = await startEmbeddedPostgres({ dir, port: await freePort() });
    stop = db.stop;
    const env = { ...process.env, DATABASE_URL: db.url };

    const out = await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: apiDir, env });
    expect(out.stdout).toMatch(/applied|1 migration/i);

    // O schema do Prisma e o banco migrado estão em sincronia (nenhuma diferença pendente).
    const diff = await execFileAsync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-url', db.url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], { cwd: apiDir, env }).catch((e) => e as { code: number; stdout: string });
    expect((diff as { code?: number }).code ?? 0).toBe(0);

    const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    try {
      const u = await prisma.user.create({ data: { email: 'm@example.com', name: 'M', passwordHash: 'x' } });
      const p = await prisma.project.create({ data: { ownerId: u.id, name: 'P', data: { a: 1 }, schemaVersion: 1 } });
      expect(p.revision).toBe(1);
      await prisma.user.delete({ where: { id: u.id } });
      expect(await prisma.project.count()).toBe(0); // cascata
    } finally {
      await prisma.$disconnect();
    }
  });
});
