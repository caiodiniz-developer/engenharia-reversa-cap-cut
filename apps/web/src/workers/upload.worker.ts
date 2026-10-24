/// <reference lib="webworker" />
/**
 * Worker de upload resumível. Lê o arquivo em partes e envia por PATCH com Upload-Offset, retomando do
 * offset informado pelo servidor após falhas de rede. Roda fora da thread principal para não travar a UI.
 */

export interface UploadRequest {
  type: 'start';
  file: File;
  projectId: string;
  token: string;
  /** Prefixo da API (padrão: mesma origem). */
  base?: string;
}

export type UploadMessage =
  | { type: 'progress'; sent: number; total: number }
  | { type: 'done'; media: unknown }
  | { type: 'error'; message: string; code?: string };

const MAX_RETRIES = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let cancelled = false;

self.onmessage = (ev: MessageEvent<UploadRequest | { type: 'cancel' }>) => {
  if (ev.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  void run(ev.data).catch((e: unknown) => {
    const err = e as Error & { code?: string };
    post({ type: 'error', message: err.message, code: err.code });
  });
};

function post(m: UploadMessage) {
  (self as unknown as Worker).postMessage(m);
}

class HttpFail extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: { offset?: number }) {
    super(message);
  }
}

async function call(url: string, token: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let body: { error?: string; code?: string; details?: { offset?: number } } = {};
    try {
      body = await res.json();
    } catch {
      /* corpo vazio */
    }
    throw new HttpFail(res.status, body.error ?? `Erro ${res.status}`, body.code, body.details);
  }
  return res;
}

async function run(req: UploadRequest): Promise<void> {
  cancelled = false;
  const base = req.base ?? '';
  const { file, projectId, token } = req;
  const init = await (
    await call(`${base}/api/projects/${projectId}/uploads`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, size: file.size, mime: file.type || 'application/octet-stream' }),
    })
  ).json();
  const id = init.uploadId as string;
  const chunk = init.chunkSize as number;

  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    if (cancelled) throw Object.assign(new Error('Envio cancelado'), { code: 'cancelled' });
    const end = Math.min(file.size, offset + chunk);
    try {
      const res = await call(`${base}/api/uploads/${id}`, token, {
        method: 'PATCH',
        headers: { 'Upload-Offset': String(offset), 'Content-Type': 'application/octet-stream' },
        body: file.slice(offset, end),
      });
      offset = ((await res.json()) as { offset: number }).offset;
      failures = 0;
      post({ type: 'progress', sent: offset, total: file.size });
    } catch (e) {
      if (e instanceof HttpFail && e.status < 500 && e.code !== 'offset_mismatch') throw e;
      if (++failures > MAX_RETRIES) throw e;
      await sleep(Math.min(8000, 400 * 2 ** failures));
      // Pergunta ao servidor até onde ele recebeu e retoma dali.
      try {
        const st = await (await call(`${base}/api/uploads/${id}`, token, { method: 'GET' })).json();
        offset = (st as { offset: number }).offset;
      } catch {
        /* a próxima iteração tenta novamente */
      }
    }
  }
  const done = await (await call(`${base}/api/uploads/${id}/complete`, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  post({ type: 'done', media: (done as { media: unknown }).media });
}
