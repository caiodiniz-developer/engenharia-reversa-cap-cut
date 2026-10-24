import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hash de senha com scrypt (módulo nativo do Node, sem dependências). Formato: scrypt$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface TokenClaims {
  sub: string;
}

export function signToken(userId: string, secret: string, ttlSeconds = 7 * 24 * 3600): string {
  return jwt.sign({ sub: userId } satisfies TokenClaims, secret, { algorithm: 'HS256', expiresIn: ttlSeconds });
}

export function verifyToken(token: string, secret: string): TokenClaims | undefined {
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof p === 'object' && typeof p.sub === 'string' ? { sub: p.sub } : undefined;
  } catch {
    return undefined;
  }
}

/** URLs assinadas: token = HMAC(resource|userId|exp). Valida posse e validade sem consultar o banco. */
export function signResource(secret: string, resource: string, userId: string, ttlSeconds: number, now = Date.now()): { exp: number; sig: string } {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return { exp, sig: mac(secret, resource, userId, exp) };
}

export function verifyResource(secret: string, resource: string, userId: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(mac(secret, resource, userId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function mac(secret: string, resource: string, userId: string, exp: number): string {
  return createHmac('sha256', secret).update(`${resource}|${userId}|${exp}`).digest('base64url');
}

/** Nome de arquivo seguro para armazenamento (sem diretórios ou caracteres de controle). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'arquivo';
  const clean = base.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '').slice(0, 120);
  return clean || 'arquivo';
}

/**
 * Cabeçalho Content-Disposition seguro (RFC 6266 / 5987): `filename` só com ASCII (fallback) e
 * `filename*` com o nome original em UTF-8. Cabeçalhos HTTP não podem carregar caracteres arbitrários.
 */
export function contentDisposition(filename: string, type: 'attachment' | 'inline' = 'attachment'): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
