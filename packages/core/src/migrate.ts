import { ProjectSchema, SCHEMA_VERSION, type Project } from './schema';

type Raw = Record<string, unknown> & { version?: number };

/**
 * Migrações incrementais: a chave N converte um projeto da versão N para N+1.
 * Ao subir SCHEMA_VERSION, adicione aqui a migração da versão anterior.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {};

export class ProjectVersionError extends Error {}

/** Carrega um projeto salvo em qualquer versão suportada e devolve um Project válido na versão atual. */
export function migrateProject(input: unknown): Project {
  if (typeof input !== 'object' || input === null) throw new ProjectVersionError('Projeto inválido');
  let raw = input as Raw;
  let version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > SCHEMA_VERSION) {
    throw new ProjectVersionError(`Projeto salvo na versão ${version}, mais nova que a suportada (${SCHEMA_VERSION})`);
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ProjectVersionError(`Sem migração disponível a partir da versão ${version}`);
    raw = { ...step(raw), version: version + 1 };
    version++;
  }
  return ProjectSchema.parse(raw);
}
