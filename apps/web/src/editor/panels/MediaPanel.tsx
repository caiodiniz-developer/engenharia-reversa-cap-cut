import { useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { MediaItem } from '../../api/types';
import { Empty, ProgressBar } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { formatBytes, formatDuration } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { toast } from '../../store/toasts';
import { useUploads } from '../../store/uploads';

type Filter = 'all' | 'video' | 'audio' | 'image';
const PAGE = 24;

export function MediaPanel({ projectId }: { projectId: string }) {
  const media = useEditor((s) => s.media);
  const usedIds = useEditor((s) => s.project.tracks.flatMap((t) => t.clips).filter((c) => c.type === 'media').map((c) => (c as { mediaId: string }).mediaId).join(','));
  const uploads = useUploads((s) => s.items);
  const upload = useUploads((s) => s.upload);
  const cancel = useUploads((s) => s.cancel);
  const clearFinished = useUploads((s) => s.clearFinished);
  const addToTimeline = useEditor((s) => s.addToTimeline);
  const removeMediaItem = useEditor((s) => s.removeMediaItem);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [over, setOver] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(media)
      .filter((m) => (filter === 'all' || m.kind === filter) && (!q || m.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }, [media, filter, query]);

  const send = (files: FileList | File[]) => {
    for (const f of Array.from(files)) void upload(projectId, f);
  };

  async function remove(m: MediaItem) {
    try {
      await api.del(`/api/media/${m.id}`);
      removeMediaItem(m.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao remover a mídia');
    }
    setConfirming(null);
  }

  const used = new Set(usedIds.split(',').filter(Boolean));
  const active = uploads.filter((u) => u.status === 'uploading');

  return (
    <div
      className={`flex h-full flex-col ${over ? 'bg-accent/5' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }
      }}
    >
      <div className="space-y-2 border-b border-line p-3">
        <input ref={inputRef} type="file" multiple accept="video/*,audio/*,image/*" className="sr-only" aria-label="Selecionar arquivos de mídia" data-testid="file-input" onChange={(e) => e.target.files && (send(e.target.files), (e.target.value = ''))} />
        <button type="button" className="btn btn-primary h-9 w-full" onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={14} /> Importar mídia
        </button>
        <p className="text-2xs text-mute">Os arquivos são enviados ao servidor para gerar prévias e exportar. Arraste e solte aqui.</p>
        <input className="field" placeholder="Buscar na biblioteca" aria-label="Buscar na biblioteca" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1" role="tablist" aria-label="Filtrar por tipo">
          {(['all', 'video', 'audio', 'image'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`flex-1 rounded-md px-2 py-1 text-2xs font-medium ${filter === f ? 'bg-panel2 text-ink' : 'text-mute hover:text-ink'}`}>
              {{ all: 'Tudo', video: 'Vídeo', audio: 'Áudio', image: 'Imagem' }[f]}
            </button>
          ))}
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2 border-b border-line p-3" aria-label="Envios">
          {uploads.slice(-4).map((u) => (
            <div key={u.id} className="text-2xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate">{u.name}</span>
                {u.status === 'uploading' ? (
                  <button type="button" className="text-mute hover:text-danger" onClick={() => cancel(u.id)}>
                    Cancelar
                  </button>
                ) : (
                  <span className={u.status === 'done' ? 'text-ok' : 'text-danger'}>{u.status === 'done' ? 'Enviado' : (u.error ?? 'Erro')}</span>
                )}
              </div>
              <ProgressBar value={u.size ? u.sent / u.size : 0} label={`Envio de ${u.name}`} />
            </div>
          ))}
          {active.length === 0 && (
            <button type="button" className="text-2xs text-mute hover:text-ink" onClick={clearFinished}>
              Limpar lista
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {items.length === 0 ? (
          <Empty icon="film" title={Object.keys(media).length ? 'Nada encontrado' : 'Biblioteca vazia'} hint={Object.keys(media).length ? 'Ajuste o filtro ou a busca.' : 'Importe vídeos, áudios ou imagens para começar.'} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2" data-testid="media-list">
              {items.slice(0, limit).map((m) => (
                <li key={m.id} className="group relative">
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`${m.name}. Clique duas vezes para adicionar à timeline`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-media-id', m.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => m.status === 'ready' && addToTimeline(m.id)}
                    onKeyDown={(e) => e.key === 'Enter' && m.status === 'ready' && addToTimeline(m.id)}
                    className="cursor-grab overflow-hidden rounded-lg border border-line bg-panel2 outline-none transition-colors hover:border-mute/50 focus-visible:border-accent active:cursor-grabbing"
                  >
                    <div className="relative flex aspect-video items-center justify-center bg-bg text-mute">
                      {m.urls.thumb ? <img src={m.urls.thumb} alt="" className="h-full w-full object-cover" draggable={false} /> : <Icon name={m.kind === 'audio' ? 'music' : m.kind === 'image' ? 'image' : 'film'} size={22} />}
                      {m.status === 'processing' && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xs">Processando…</span>}
                      {m.status === 'failed' && <span className="absolute inset-0 flex items-center justify-center bg-black/70 px-1 text-center text-2xs text-danger">Falhou</span>}
                      {m.kind !== 'image' && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-2xs">{formatDuration(m.duration)}</span>}
                      {used.has(m.id) && <span className="absolute left-1 top-1 rounded bg-accent px-1 text-2xs font-medium text-bg">Em uso</span>}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className="truncate text-2xs font-medium" title={m.name}>
                        {m.name}
                      </p>
                      <p className="text-2xs text-mute">{formatBytes(m.size)}</p>
                    </div>
                  </div>
                  <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" className="btn-icon !h-6 !w-6 bg-bg/80 backdrop-blur" aria-label={`Adicionar ${m.name} à timeline`} disabled={m.status !== 'ready'} onClick={() => addToTimeline(m.id)}>
                      <Icon name="plus" size={13} />
                    </button>
                    <button type="button" className="btn-icon !h-6 !w-6 bg-bg/80 backdrop-blur" aria-label={`Remover ${m.name}`} onClick={() => (used.has(m.id) ? setConfirming(m.id) : void remove(m))}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  {confirming === m.id && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/85 p-2 text-center">
                      <p className="text-2xs">Esta mídia está na timeline. Remover também apaga seus clipes.</p>
                      <div className="flex gap-1">
                        <button type="button" className="btn !h-6 px-2 text-2xs" onClick={() => setConfirming(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="btn !h-6 border-danger bg-danger px-2 text-2xs text-white" onClick={() => void remove(m)}>
                          Remover
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {items.length > limit && (
              <button type="button" className="btn mt-3 w-full" onClick={() => setLimit(limit + PAGE)}>
                Carregar mais ({items.length - limit})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
