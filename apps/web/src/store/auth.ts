import { create } from 'zustand';
import { api, ApiError, getToken, onUnauthorized, setToken } from '../api/client';
import { EventsClient } from '../api/events';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  /** 'loading' enquanto valida o token salvo ao abrir o app. */
  status: 'loading' | 'anonymous' | 'authenticated';
  events: EventsClient | null;
  error: string | null;
  restore(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
  updateSettings(patch: Partial<User['settings']>): Promise<void>;
}

function connect(token: string, set: (s: Partial<AuthState>) => void, get: () => AuthState) {
  get().events?.stop();
  const events = new EventsClient(token);
  events.start();
  set({ events });
}

export const useAuth = create<AuthState>((set, get) => {
  onUnauthorized(() => {
    get().events?.stop();
    set({ user: null, status: 'anonymous', events: null });
  });

  const finish = (token: string, user: User) => {
    setToken(token);
    set({ user, status: 'authenticated', error: null });
    connect(token, set, get);
  };

  return {
    user: null,
    status: getToken() ? 'loading' : 'anonymous',
    events: null,
    error: null,

    async restore() {
      const token = getToken();
      if (!token) return set({ status: 'anonymous' });
      try {
        const { user } = await api.get<{ user: User }>('/api/auth/me');
        set({ user, status: 'authenticated' });
        connect(token, set, get);
      } catch (e) {
        // Sem rede: mantém a sessão para tentar de novo; token recusado já foi limpo pelo cliente.
        if (e instanceof ApiError && e.status === 0) set({ status: 'anonymous', error: e.message });
        else set({ status: 'anonymous' });
      }
    },

    async login(email, password) {
      const r = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
      finish(r.token, r.user);
    },

    async register(name, email, password) {
      const r = await api.post<{ token: string; user: User }>('/api/auth/register', { name, email, password });
      finish(r.token, r.user);
    },

    logout() {
      get().events?.stop();
      setToken(null);
      set({ user: null, status: 'anonymous', events: null });
    },

    async updateSettings(patch) {
      const { user } = await api.patch<{ user: User }>('/api/auth/settings', patch);
      set({ user });
    },
  };
});
