import { useMemo } from 'react';
import { formatTimecode, projectStats } from '@editor/core';
import { Modal } from '../components/controls';
import { Icon, type IconName } from '../components/Icon';
import { formatBytes } from '../lib/format';
import { useEditor } from '../store/editor';

function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-2xs text-mute">
        <Icon name={icon} size={12} /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums leading-none">{value}</div>
      {hint && <div className="mt-1 truncate text-2xs text-mute">{hint}</div>}
    </div>
  );
}

/** Números do projeto: duração, clipes por tipo, mídia usada, palavras e extremos. Tudo calculado por `projectStats` do núcleo. */
export function StatsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);
  const stats = useMemo(() => projectStats(project), [project]);
  const fps = project.settings.fps;
  const { clips, media } = stats;

  function pick(id: string | undefined) {
    if (!id) return;
    select([id]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Estatísticas do projeto" width={520}>
      {stats.clips.total === 0 ? (
        <p className="py-8 text-center text-xs text-mute" data-testid="stats-empty">
          O projeto ainda não tem clipes. Adicione mídia à timeline para ver os números.
        </p>
      ) : (
        <div data-testid="stats">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat icon="clock" label="Duração" value={formatTimecode(stats.duration, fps)} hint={stats.duration.toFixed(1).replace('.', ',') + ' s'} />
            <Stat icon="layers" label="Clipes" value={String(clips.total)} hint={stats.tracks + (stats.tracks === 1 ? ' faixa' : ' faixas')} />
            <Stat icon="gauge" label="Duração média" value={stats.averageClip.toFixed(1).replace('.', ',') + ' s'} hint="por clipe" />
            <Stat icon="type" label="Palavras" value={String(stats.words)} hint="em textos e legendas" />
            <Stat icon="flag" label="Marcadores" value={String(stats.markers)} />
            <Stat icon="film" label="Mídia usada" value={media.used + ' de ' + media.imported} hint={formatBytes(media.usedBytes) + ' em arquivos'} />
          </div>
          <h3 className="mb-1.5 mt-4 text-2xs font-semibold uppercase tracking-wider text-mute">Clipes por tipo</h3>
          <ul className="space-y-1.5" data-testid="stats-kinds">
            {(
              [
                ['video', 'Vídeo', 'film'],
                ['image', 'Imagem', 'image'],
                ['audio', 'Áudio', 'music'],
                ['text', 'Texto', 'type'],
                ['caption', 'Legenda', 'captions'],
              ] as const
            ).map(([k, label, icon]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <Icon name={icon} size={13} className="text-mute" />
                <span className="w-16">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
                  <span className="block h-full rounded-full bg-accent" style={{ width: (clips[k] / clips.total) * 100 + '%' }} />
                </span>
                <span className="w-6 text-right tabular-nums">{clips[k]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.longest && (
              <button type="button" className="btn" onClick={() => pick(stats.longest?.id)} data-testid="stats-longest">
                Selecionar o clipe mais longo ({stats.longest.duration.toFixed(1).replace('.', ',')} s)
              </button>
            )}
            {stats.shortest && stats.shortest.id !== stats.longest?.id && (
              <button type="button" className="btn" onClick={() => pick(stats.shortest?.id)} data-testid="stats-shortest">
                Selecionar o mais curto ({stats.shortest.duration.toFixed(1).replace('.', ',')} s)
              </button>
            )}
          </div>
          {media.unused > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-2xs text-mute">
              <Icon name="info" size={12} /> {media.unused} {media.unused === 1 ? 'mídia importada não é usada' : 'mídias importadas não são usadas'}: veja “Limpar mídias não usadas” na paleta.
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
