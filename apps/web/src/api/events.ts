import type { ServerEvent } from './types';

type Listener = (e: ServerEvent) => void;

/**
 * Conexão WebSocket com reconexão exponencial. Autentica pela primeira mensagem (o token não vai na URL).
 */
export class EventsClient {
  private ws?: WebSocket;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<(connected: boolean) => void>();
  private retry = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  connected = false;

  constructor(private token: string, private url = defaultUrl()) {}

  start(): void {
    this.closed = false;
    this.open();
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onState(fn: (connected: boolean) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  stop(): void {
    this.closed = true;
    clearTimeout(this.timer);
    this.ws?.close();
    this.setConnected(false);
  }

  private setConnected(v: boolean) {
    if (this.connected !== v) {
      this.connected = v;
      this.stateListeners.forEach((fn) => fn(v));
    }
  }

  private open() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.token }));
    ws.onmessage = (ev) => {
      let msg: ServerEvent;
      try {
        msg = JSON.parse(String(ev.data)) as ServerEvent;
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        this.retry = 0;
        this.setConnected(true);
      }
      this.listeners.forEach((fn) => fn(msg));
    };
    ws.onclose = (ev) => {
      this.setConnected(false);
      if (this.closed || ev.code === 4401) return; // token inválido: não adianta reconectar
      const delay = Math.min(15_000, 500 * 2 ** this.retry++);
      this.timer = setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => ws.close();
  }
}

function defaultUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
