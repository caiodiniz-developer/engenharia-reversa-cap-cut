import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { contentDisposition, hashPassword, sanitizeFilename, signResource, signToken, verifyPassword, verifyResource, verifyToken } from '../src/security';
import { LocalObjectStore } from '../src/storage';
import { loadConfig } from '../src/config';

describe('senhas', () => {
  it('verifica a senha correta e rejeita a errada; hashes usam sal', async () => {
    const h1 = await hashPassword('minha-senha-123');
    const h2 = await hashPassword('minha-senha-123');
    expect(h1).not.toBe(h2);
    expect(h1.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('minha-senha-123', h1)).toBe(true);
    expect(await verifyPassword('outra-senha-123', h1)).toBe(false);
    expect(await verifyPassword('x', 'formato-invalido')).toBe(false);
  });
});

describe('tokens', () => {
  const secret = 'a'.repeat(40);
  it('assina, valida e rejeita segredo errado, adulteração e expiração', async () => {
    const tk = signToken('u1', secret);
    expect(verifyToken(tk, secret)).toEqual({ sub: 'u1' });
    expect(verifyToken(tk, 'b'.repeat(40))).toBeUndefined();
    expect(verifyToken(`${tk}x`, secret)).toBeUndefined();
    expect(verifyToken(signToken('u1', secret, -10), secret)).toBeUndefined();
    // alg=none não é aceito
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"u1"}').toString('base64url')}.`;
    expect(verifyToken(none, secret)).toBeUndefined();
  });
});

describe('URLs assinadas', () => {
  const secret = 's'.repeat(40);
  it('valida recurso, usuário e expiração', () => {
    const now = 1_700_000_000_000;
    const { exp, sig } = signResource(secret, 'media:1:original', 'u1', 60, now);
    expect(verifyResource(secret, 'media:1:original', 'u1', exp, sig, now)).toBe(true);
    expect(verifyResource(secret, 'media:2:original', 'u1', exp, sig, now)).toBe(false);
    expect(verifyResource(secret, 'media:1:original', 'u2', exp, sig, now)).toBe(false);
    expect(verifyResource(secret, 'media:1:original', 'u1', exp + 1, sig, now)).toBe(false);
    expect(verifyResource(secret, 'media:1:original', 'u1', exp, sig, now + 61_000)).toBe(false);
    expect(verifyResource('t'.repeat(40), 'media:1:original', 'u1', exp, sig, now)).toBe(false);
    expect(verifyResource(secret, 'media:1:original', 'u1', Number.NaN, sig, now)).toBe(false);
  });
});

describe('nomes de arquivo', () => {
  it('remove diretórios, caracteres perigosos e pontos iniciais', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\x\\vídeo final.mp4')).toBe('vídeo final.mp4');
    expect(sanitizeFilename('a<b>|c?.mp4')).toBe('a_b__c_.mp4');
    expect(sanitizeFilename('.bashrc')).toBe('bashrc');
    expect(sanitizeFilename('')).toBe('arquivo');
    expect(sanitizeFilename('x'.repeat(500)).length).toBe(120);
  });
});

describe('Content-Disposition', () => {
  it('mantém o cabeçalho ASCII e carrega o nome real em filename* (RFC 6266)', () => {
    expect(contentDisposition('relatório final.mp4')).toBe(`attachment; filename="relat_rio final.mp4"; filename*=UTF-8''relat%C3%B3rio%20final.mp4`);
    expect(contentDisposition('a"b\\c.mp4')).toContain('filename="a_b_c.mp4"');
    expect(contentDisposition("it's (1)*.mp4")).toContain("filename*=UTF-8''it%27s%20%281%29%2A.mp4");
    // Todo caractere do valor final é ASCII imprimível: seguro para qualquer servidor/proxy.
    for (const name of ['日本語.mp4', 'emoji 🎬.mp4', 'ção\n.mp4']) expect(contentDisposition(name)).toMatch(/^[\x20-\x7e]+$/);
  });
});

describe('armazenamento local', () => {
  let dir: string;
  afterAll(async () => dir && (await rm(dir, { recursive: true, force: true })));

  it('grava, lê trechos, apaga e bloqueia path traversal', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'store-'));
    const store = new LocalObjectStore(dir);
    expect(await store.put('a/b/c.txt', Buffer.from('0123456789'))).toBe(10);
    expect(await store.put('stream.bin', Readable.from([Buffer.from('abc')]))).toBe(3);
    expect(await store.size('a/b/c.txt')).toBe(10);
    expect(await store.size('nao-existe')).toBeUndefined();
    const chunks: Buffer[] = [];
    for await (const c of store.stream('a/b/c.txt', { start: 2, end: 4 })) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('234');
    expect(await readFile(store.localPath('stream.bin'), 'utf8')).toBe('abc');

    for (const bad of ['../fora.txt', '../../etc/passwd', 'a/../../x', '/etc/passwd', '']) {
      expect(() => store.localPath(bad), bad).toThrow(/inválida/);
    }
    await store.deletePrefix('a');
    expect(await store.size('a/b/c.txt')).toBeUndefined();
    await expect(store.deletePrefix('..')).rejects.toThrow();
  });
});

describe('configuração', () => {
  it('exige JWT_SECRET em produção e valida valores', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }).jwtSecret).toHaveLength(32);
    expect(() => loadConfig({ JWT_SECRET: 'curto' })).toThrow();
    expect(loadConfig({ NODE_ENV: 'test' }).jwtSecret.length).toBeGreaterThanOrEqual(32);
  });
});
