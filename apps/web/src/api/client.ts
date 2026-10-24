const TOKEN_KEY = 'editor.token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let token: string | null = safeGet();
const unauthorizedListeners = new Set<() => void>();

function safeGet(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* armazenamento indisponível (modo privado): o token fica só em memória */
  }
}

export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

export async function request<T>(method: string, url: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let payload: BodyInit | undefined;
  if (body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) payload = body as BodyInit;
  else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, method, headers, body: payload });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Sem conexão com o servidor', 'network');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string; details?: unknown };
    if (res.status === 401 && token) {
      setToken(null);
      unauthorizedListeners.forEach((fn) => fn());
    }
    throw new ApiError(res.status, err.error ?? `Erro ${res.status}`, err.code ?? 'error', err.details);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string, init?: RequestInit) => request<T>('GET', url, undefined, init),
  post: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('POST', url, body ?? {}, init),
  put: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('PUT', url, body, init),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T = void>(url: string) => request<T>('DELETE', url),
};
