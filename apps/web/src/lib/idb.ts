import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '@editor/core';

/**
 * Cache local no navegador (IndexedDB). NÃO substitui o servidor: guarda rascunhos para recuperação após
 * queda/fechamento, formas de onda já baixadas e modelos de texto do usuário.
 */
interface EditorDB extends DBSchema {
  drafts: { key: string; value: Draft };
  waveforms: { key: string; value: { mediaId: string; peaks: number[] } };
  templates: { key: string; value: TextTemplate };
}

export interface Draft {
  projectId: string;
  /** Revisão do servidor sobre a qual o rascunho foi feito. */
  baseRevision: number;
  savedAt: number;
  project: Project;
}

export interface TextTemplate {
  id: string;
  name: string;
  /** Campos de TextStyle serializados. */
  style: Record<string, unknown>;
  text: string;
}

let dbPromise: Promise<IDBPDatabase<EditorDB>> | undefined;

function db(): Promise<IDBPDatabase<EditorDB>> {
  dbPromise ??= openDB<EditorDB>('editor', 1, {
    upgrade(d) {
      d.createObjectStore('drafts', { keyPath: 'projectId' });
      d.createObjectStore('waveforms', { keyPath: 'mediaId' });
      d.createObjectStore('templates', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

/** Executa a operação ignorando indisponibilidade do IndexedDB (modo privado, cota, bloqueio). */
async function safe<T>(fn: (d: IDBPDatabase<EditorDB>) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(await db());
  } catch {
    return fallback;
  }
}

export const drafts = {
  save: (d: Draft) => safe((x) => x.put('drafts', d).then(() => undefined), undefined),
  get: (projectId: string) => safe((x) => x.get('drafts', projectId), undefined),
  remove: (projectId: string) => safe((x) => x.delete('drafts', projectId), undefined),
};

export const waveforms = {
  save: (mediaId: string, peaks: number[]) => safe((x) => x.put('waveforms', { mediaId, peaks }).then(() => undefined), undefined),
  get: (mediaId: string) => safe(async (x) => (await x.get('waveforms', mediaId))?.peaks, undefined),
};

export const templates = {
  save: (t: TextTemplate) => safe((x) => x.put('templates', t).then(() => undefined), undefined),
  all: () => safe((x) => x.getAll('templates'), [] as TextTemplate[]),
  remove: (id: string) => safe((x) => x.delete('templates', id), undefined),
};
