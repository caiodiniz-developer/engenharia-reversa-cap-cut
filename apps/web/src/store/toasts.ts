import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  message: string;
  /** Milissegundos até sumir sozinho (0 = fica até ser dispensado). */
  ttl: number;
  /** Botão opcional do aviso; clicar executa e dispensa o aviso. */
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push(kind: Toast['kind'], message: string, ttl?: number, action?: Toast['action']): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message, ttlArg, action) {
    const id = nextId++;
    const ttl = ttlArg ?? (action || kind === 'error' ? 6000 : 3500);
    set({ toasts: [...get().toasts.slice(-4), { id, kind, message, ttl, action }] });
    if (ttl > 0) setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (m: string) => useToasts.getState().push('info', m),
  success: (m: string, action?: Toast['action']) => useToasts.getState().push('success', m, undefined, action),
  error: (m: string) => useToasts.getState().push('error', m),
};
