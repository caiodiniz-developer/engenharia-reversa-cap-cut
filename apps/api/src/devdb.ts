import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

export interface EmbeddedDb {
  url: string;
  stop(): Promise<void>;
}

/**
 * Sobe um PostgreSQL real (binários do pacote embedded-postgres) para desenvolvimento e testes,
 * sem exigir instalação do servidor nem Docker. Em produção use um PostgreSQL gerenciado.
 */
export async function startEmbeddedPostgres(opts: {
  dir: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
}): Promise<EmbeddedDb> {
  const user = opts.user ?? 'editor';
  const password = opts.password ?? 'editor';
  const database = opts.database ?? 'editor';
  await mkdir(opts.dir, { recursive: true });
  const fresh = (await readdir(opts.dir)).length === 0;
  const pg = new EmbeddedPostgres({
    databaseDir: opts.dir,
    user,
    password,
    port: opts.port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase(database);
  return {
    url: `postgresql://${user}:${password}@localhost:${opts.port}/${database}?schema=public`,
    stop: () => pg.stop(),
  };
}

// `pnpm db:dev` — mantém um banco de desenvolvimento rodando até Ctrl+C.
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const dir = process.env.PGDATA_DIR ?? path.resolve('.pgdata');
  const port = Number(process.env.PGPORT ?? 54329);
  const db = await startEmbeddedPostgres({ dir, port });
  console.log(`PostgreSQL de desenvolvimento em ${db.url}`);
  const stop = async () => {
    await db.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
