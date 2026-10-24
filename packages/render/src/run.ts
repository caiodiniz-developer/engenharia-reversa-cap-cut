import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Project } from '@editor/core';
import { buildRenderPlan, RenderError, type RenderEnv, type RenderOptions, type RenderPlan } from './plan';

export interface RunHandlers {
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export class RenderCancelled extends Error {
  constructor() {
    super('Renderização cancelada');
  }
}

/** Executa o FFmpeg sem shell, acompanhando o progresso (-progress pipe:1) e respeitando cancelamento. */
export function runFfmpeg(plan: RenderPlan, handlers: RunHandlers = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (handlers.signal?.aborted) return reject(new RenderCancelled());
    const child = spawn(plan.ffmpeg, plan.args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    let buf = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-8000);
    });
    child.stdout.on('data', (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const m = /^out_time_(?:us|ms)=(\d+)$/.exec(line);
        if (m && handlers.onProgress) {
          // out_time_us e out_time_ms (também em microssegundos) trazem o mesmo valor.
          handlers.onProgress(Math.min(1, Number(m[1]) / 1e6 / plan.duration));
        }
      }
    });
    const onAbort = () => {
      child.kill('SIGKILL');
    };
    handlers.signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (e) => {
      handlers.signal?.removeEventListener('abort', onAbort);
      reject(e);
    });
    child.on('close', (code) => {
      handlers.signal?.removeEventListener('abort', onAbort);
      if (handlers.signal?.aborted) return reject(new RenderCancelled());
      if (code === 0) {
        handlers.onProgress?.(1);
        resolve();
      } else {
        reject(new RenderError(`FFmpeg terminou com código ${code}: ${stderr.trim().slice(-1500)}`));
      }
    });
  });
}

/**
 * Renderiza o projeto em `outputBase` + extensão do codec. Cria e limpa o diretório temporário.
 * Devolve o caminho final do arquivo.
 */
export async function renderProject(
  project: Project,
  opts: RenderOptions,
  env: Omit<RenderEnv, 'tmpDir'> & { tmpRoot?: string },
  outputBase: string,
  handlers: RunHandlers = {},
): Promise<{ file: string; plan: RenderPlan }> {
  const tmpDir = await mkdtemp(path.join(env.tmpRoot ?? os.tmpdir(), 'render-'));
  try {
    // A extensão depende do codec, então planejamos com um nome provisório e ajustamos.
    const ext = (opts.codec ?? 'h264') === 'vp9' ? 'webm' : 'mp4';
    const output = `${outputBase}.${ext}`;
    const plan = await buildRenderPlan(project, opts, { resolveMedia: env.resolveMedia, tmpDir }, output);
    await runFfmpeg(plan, handlers);
    return { file: output, plan };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
