import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

// Carrega apps/api/.env quando existir (não é versionado). Variáveis do ambiente têm prioridade.
const envFile = path.resolve(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const GB = 1024 ** 3;

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url().optional(),
  /** Segredo do JWT. Obrigatório em produção; em dev/teste gera-se um valor efêmero. */
  JWT_SECRET: z.string().min(32).optional(),
  /** Segredo das URLs assinadas de mídia (padrão: JWT_SECRET). */
  URL_SIGNING_SECRET: z.string().min(32).optional(),
  STORAGE_DIR: z.string().default(path.resolve('storage')),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:3001'),
  MAX_UPLOAD_BYTES: z.coerce.number().default(2 * GB),
  MAX_MEDIA_SECONDS: z.coerce.number().default(2 * 3600),
  MAX_PROJECT_MEDIA: z.coerce.number().default(200),
  EXPORT_CONCURRENCY: z.coerce.number().default(1),
  PROCESSING_CONCURRENCY: z.coerce.number().default(2),
  EXPORT_RETENTION_HOURS: z.coerce.number().default(24),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),
  JOB_MAX_ATTEMPTS: z.coerce.number().default(2),
  /** Limite de renderização em segundos antes de o job ser abortado. */
  EXPORT_TIMEOUT_SECONDS: z.coerce.number().default(3600),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(20),
  // IA (as chaves ficam apenas no servidor)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_TRANSCRIBE_MODEL: z.string().default('whisper-1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  /** Binário do whisper.cpp (whisper-cli) e modelo ggml para transcrição local. */
  WHISPER_BIN: z.string().optional(),
  WHISPER_MODEL: z.string().optional(),
  /** Teto de gasto/uso de IA por usuário por dia (nº de chamadas pagas). */
  AI_DAILY_CALL_LIMIT: z.coerce.number().default(50),
  /** Nº de proxies confiáveis à frente da API (nginx = 1). Necessário para o rate limit enxergar o IP real. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type Config = z.infer<typeof Env> & {
  jwtSecret: string;
  signingSecret: string;
  corsOrigins: string[];
  tmpDir: string;
};

export function loadConfig(overrides: Partial<z.input<typeof Env>> = {}): Config {
  const env = Env.parse({ ...process.env, ...overrides });
  if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET é obrigatório em produção');
  }
  const jwtSecret = env.JWT_SECRET ?? `${globalThis.crypto.randomUUID()}${globalThis.crypto.randomUUID()}`;
  return {
    ...env,
    jwtSecret,
    signingSecret: env.URL_SIGNING_SECRET ?? jwtSecret,
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    tmpDir: path.join(process.env.TEMP_DIR ?? os.tmpdir(), 'editor-api'),
  };
}
