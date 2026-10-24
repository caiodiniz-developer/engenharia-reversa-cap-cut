import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push(kind: Toast['kind'], message: string, ttl?: number): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message, ttl = kind === 'error' ? 6000 : 3500) {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-4), { id, kind, message }] });
    if (ttl > 0) setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (m: string) => useToasts.getState().push('info', m),
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
};
