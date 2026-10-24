import { create } from 'zustand';
import { getToken } from '../api/client';
import type { MediaItem } from '../api/types';
import type { UploadMessage, UploadRequest } from '../workers/upload.worker';
import { useEditor } from './editor';
import { toast } from './toasts';

export interface UploadEntry {
  id: number;
  name: string;
  size: number;
  sent: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadsState {
  items: UploadEntry[];
  upload(projectId: string, file: File): Promise<MediaItem | undefined>;
  cancel(id: number): void;
  clearFinished(): void;
}

const workers = new Map<number, Worker>();
let nextId = 1;

export const MAX_BROWSER_UPLOAD = 2 * 1024 ** 3;

export const useUploads = create<UploadsState>((set, get) => ({
  items: [],

  upload(projectId, file) {
    const token = getToken();
    if (!token) return Promise.resolve(undefined);
    if (!/^(video|audio|image)\//.test(file.type)) {
      toast.error(`"${file.name}": tipo de arquivo não suportado (use vídeo, áudio ou imagem)`);
      return Promise.resolve(undefined);
    }
    if (file.size > MAX_BROWSER_UPLOAD) {
      toast.error(`"${file.name}" excede 2 GB`);
      return Promise.resolve(undefined);
    }
    const id = nextId++;
    const patch = (p: Partial<UploadEntry>) => set({ items: get().items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
    set({ items: [...get().items, { id, name: file.name, size: file.size, sent: 0, status: 'uploading' }] });

    return new Promise<MediaItem | undefined>((resolve) => {
      const worker = new Worker(new URL('../workers/upload.worker.ts', import.meta.url), { type: 'module' });
      workers.set(id, worker);
      const finish = () => {
        worker.terminate();
        workers.delete(id);
      };
      worker.onmessage = (ev: MessageEvent<UploadMessage>) => {
        const m = ev.data;
        if (m.type === 'progress') patch({ sent: m.sent });
        else if (m.type === 'done') {
          patch({ status: 'done', sent: file.size });
          finish();
          const item = m.media as MediaItem;
          useEditor.getState().importMedia(item);
          resolve(item);
        } else {
          patch({ status: 'error', error: m.message });
          if (m.code !== 'cancelled') toast.error(`Falha ao enviar "${file.name}": ${m.message}`);
          finish();
          resolve(undefined);
        }
      };
      worker.onerror = () => {
        patch({ status: 'error', error: 'Erro no envio' });
        finish();
        resolve(undefined);
      };
      worker.postMessage({ type: 'start', file, projectId, token } satisfies UploadRequest);
    });
  },

  cancel(id) {
    workers.get(id)?.postMessage({ type: 'cancel' });
  },

  clearFinished() {
    set({ items: get().items.filter((i) => i.status === 'uploading') });
  },
}));
