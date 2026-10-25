import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

/**
 * Armazenamento de objetos. A implementação local grava em disco; outra (S3/MinIO) pode ser plugada
 * implementando esta interface sem mudar o restante da API.
 */
export interface ObjectStore {
  put(key: string, data: Buffer | Readable): Promise<number>;
  /** Caminho local do objeto (necessário para o FFmpeg). */
  localPath(key: string): string;
  /** Copia um objeto (usado ao duplicar projetos). */
  copy(srcKey: string, dstKey: string): Promise<void>;
  size(key: string): Promise<number | undefined>;
  stream(key: string, range?: { start: number; end: number }): Readable;
  delete(key: string): Promise<void>;
  /** Remove todos os objetos com o prefixo (ex.: projeto inteiro). */
  deletePrefix(prefix: string): Promise<void>;
}

/** Garante que a chave não escape do diretório raiz. */
function safeJoin(root: string, key: string): string {
  const full = path.resolve(root, key);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel === '') throw new Error(`Chave de armazenamento inválida: ${key}`);
  return full;
}

export class LocalObjectStore implements ObjectStore {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  localPath(key: string): string {
    return safeJoin(this.root, key);
  }

  async put(key: string, data: Buffer | Readable): Promise<number> {
    const file = this.localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    if (Buffer.isBuffer(data)) await writeFile(file, data);
    else await pipeline(data, createWriteStream(file));
    return (await stat(file)).size;
  }

  async copy(srcKey: string, dstKey: string): Promise<void> {
    const dst = this.localPath(dstKey);
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(this.localPath(srcKey), dst);
  }

  async size(key: string): Promise<number | undefined> {
    try {
      return (await stat(this.localPath(key))).size;
    } catch {
      return undefined;
    }
  }

  stream(key: string, range?: { start: number; end: number }): Readable {
    return createReadStream(this.localPath(key), range);
  }

  async delete(key: string): Promise<void> {
    await rm(this.localPath(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(safeJoin(this.root, prefix), { recursive: true, force: true });
  }
}
