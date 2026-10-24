import { execFile } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Config } from '../config';
import { HttpError } from '../http';

const execFileAsync = promisify(execFile);

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface Transcript {
  language: string;
  text: string;
  words: TranscriptWord[];
  provider: string;
}

type FetchFn = typeof fetch;

/**
 * Integra provedores de IA. As chaves existem apenas no servidor. Quando nenhum provedor está
 * configurado, as operações respondem 503 com instrução clara: nada é simulado.
 */
export class AiService {
  constructor(
    private config: Config,
    private fetchImpl: FetchFn = fetch,
  ) {}

  transcriptionProvider(): 'whisper.cpp' | 'openai' | null {
    if (this.config.WHISPER_BIN && this.config.WHISPER_MODEL) return 'whisper.cpp';
    if (this.config.OPENAI_API_KEY) return 'openai';
    return null;
  }

  llmAvailable(): boolean {
    return !!this.config.ANTHROPIC_API_KEY;
  }

  requireTranscription(): 'whisper.cpp' | 'openai' {
    const p = this.transcriptionProvider();
    if (!p) {
      throw new HttpError(503, 'Transcrição indisponível: configure WHISPER_BIN + WHISPER_MODEL (local) ou OPENAI_API_KEY no servidor.', 'ai_not_configured');
    }
    return p;
  }

  requireLlm(): void {
    if (!this.llmAvailable()) {
      throw new HttpError(503, 'Assistente indisponível: configure ANTHROPIC_API_KEY no servidor.', 'ai_not_configured');
    }
  }

  /** `wav`: áudio mono 16 kHz. Prefere o provedor local (os dados não saem do servidor). */
  async transcribe(wav: string, opts: { language?: string; signal?: AbortSignal }): Promise<Transcript> {
    const provider = this.requireTranscription();
    return provider === 'whisper.cpp' ? this.transcribeLocal(wav, opts) : this.transcribeOpenAi(wav, opts);
  }

  private async transcribeOpenAi(wav: string, opts: { language?: string; signal?: AbortSignal }): Promise<Transcript> {
    const form = new FormData();
    form.append('file', await openAsBlob(wav, { type: 'audio/wav' }), path.basename(wav));
    form.append('model', this.config.OPENAI_TRANSCRIBE_MODEL);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    if (opts.language) form.append('language', opts.language);
    const res = await this.fetchImpl(`${this.config.OPENAI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.OPENAI_API_KEY}` },
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`Falha na transcrição (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = z
      .object({
        language: z.string().optional(),
        text: z.string(),
        words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })).optional(),
      })
      .parse(await res.json());
    return {
      language: body.language ?? opts.language ?? 'unknown',
      text: body.text.trim(),
      words: (body.words ?? []).map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })).filter((w) => w.text),
      provider: 'openai',
    };
  }

  private async transcribeLocal(wav: string, opts: { language?: string; signal?: AbortSignal }): Promise<Transcript> {
    const outBase = wav.replace(/\.wav$/i, '');
    // -ml 1 + -sow: um segmento por palavra, com tempos em ms; -oj grava <base>.json.
    const args = ['-m', this.config.WHISPER_MODEL!, '-f', wav, '-l', opts.language ?? 'auto', '-ml', '1', '-sow', '-oj', '-of', outBase];
    await execFileAsync(this.config.WHISPER_BIN!, args, { signal: opts.signal, maxBuffer: 32 * 1024 * 1024, timeout: 60 * 60_000 });
    const raw = JSON.parse(await readFile(`${outBase}.json`, 'utf8')) as {
      result?: { language?: string };
      transcription?: Array<{ offsets: { from: number; to: number }; text: string }>;
    };
    await rm(`${outBase}.json`, { force: true });
    const words = (raw.transcription ?? [])
      .map((s) => ({ text: s.text.trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
      .filter((w) => w.text && !/^\[.*\]$/.test(w.text));
    return { language: raw.result?.language ?? opts.language ?? 'unknown', text: words.map((w) => w.text).join(' '), words, provider: 'whisper.cpp' };
  }

  /** Chama a API Messages da Anthropic exigindo JSON; valida com o schema informado. */
  async llmJson<T extends z.ZodTypeAny>(system: string, user: string, schema: T, signal?: AbortSignal): Promise<z.infer<T>> {
    this.requireLlm();
    const base = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
    const res = await this.fetchImpl(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.config.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.config.ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: `${system}\nResponda SOMENTE com um objeto JSON válido, sem texto antes ou depois.`,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Falha no assistente (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('A resposta do assistente não contém JSON');
    return schema.parse(JSON.parse(text.slice(start, end + 1)));
  }
}
