import { useEffect, useMemo, useState } from 'react';
import { sequenceOrder } from '@editor/core';
import { Select } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { formatDuration } from '../../lib/format';
import { useEditor } from '../../store/editor';

/** Roteiro visual: os planos de uma faixa de vídeo em ordem, com troca de lugar, montagem no ritmo e encaixe na duração. */
export function StoryboardPanel() {
  const project = useEditor((s) => s.project);
  const media = useEditor((s) => s.media);
  const selection = useEditor((s) => s.selection);
  const selectedTrackId = useEditor((s) => s.selectedTrackId);
  const move = useEditor((s) => s.moveClipInSequence);
  const montage = useEditor((s) => s.montageTrack);
  const fit = useEditor((s) => s.fitSelectionToDuration);
  const [target, setTarget] = useState('30');

  const videoTracks = project.tracks.filter((t) => t.kind === 'video');
  const [trackId, setTrackId] = useState<string>('');
  useEffect(() => {
    // segue a faixa selecionada na timeline; senão, a primeira de vídeo
    if (selectedTrackId && videoTracks.some((t) => t.id === selectedTrackId)) setTrackId(selectedTrackId);
    else if (!videoTracks.some((t) => t.id === trackId)) setTrackId(videoTracks[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrackId, project.tracks.length]);

  const clips = useMemo(() => (trackId && project.tracks.some((t) => t.id === trackId) ? sequenceOrder(project, trackId) : []), [project, trackId]);
  const markers = project.markers.length;
  const total = clips.reduce((n, c) => n + c.duration, 0);

  const pick = (id: string, start: number) => {
    const st = useEditor.getState();
    st.select([id]);
    st.setPlaying(false);
    st.setPlayhead(start);
  };

  if (videoTracks.length === 0) return <p className="p-4 text-2xs text-mute">Adicione uma faixa de vídeo para ver o roteiro visual.</p>;

  return (
    <div className="flex h-full flex-col" data-testid="storyboard-panel">
      <div className="space-y-2 border-b border-line p-3">
        {videoTracks.length > 1 && <Select label="Faixa" value={trackId} onChange={setTrackId} options={videoTracks.map((t) => ({ value: t.id, label: t.name }))} />}
        <p className="text-2xs text-mute" data-testid="storyboard-total">
          {clips.length} {clips.length === 1 ? 'plano' : 'planos'} · {formatDuration(total)} de imagem
        </p>
      </div>

      <ol className="min-h-0 flex-1 space-y-1.5 overflow-auto p-3" data-testid="storyboard-list">
        {clips.length === 0 && <li className="text-2xs text-mute">Esta faixa ainda não tem clipes.</li>}
        {clips.map((c, i) => {
          const m = c.type === 'media' ? media[c.mediaId] : undefined;
          const name = m?.name ?? (c.type === 'media' ? 'Mídia' : c.text);
          const on = selection.includes(c.id);
          return (
            <li key={c.id} className={`card flex items-center gap-2 p-1.5 ${on ? 'border-accent' : ''}`} data-testid="storyboard-item" data-clip-id={c.id}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => pick(c.id, c.start)} aria-label={`Plano ${i + 1}: ${name}`}>
                <span className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-bg text-mute">
                  {m?.urls.thumb ? <img src={m.urls.thumb} alt="" className="h-full w-full object-cover" /> : <Icon name="film" size={16} />}
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{i + 1}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium" title={name}>
                    {name}
                  </span>
                  <span className="tnum block text-2xs text-mute">
                    {formatDuration(c.start)} · {String(Math.round(c.duration * 10) / 10).replace('.', ',')} s
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col">
                <button type="button" className="btn-icon !h-5 !w-6" disabled={i === 0} aria-label={`Mover plano ${i + 1} para antes`} onClick={() => move(c.id, -1)}>
                  <Icon name="chevronUp" size={13} />
                </button>
                <button type="button" className="btn-icon !h-5 !w-6" disabled={i === clips.length - 1} aria-label={`Mover plano ${i + 1} para depois`} onClick={() => move(c.id, 1)}>
                  <Icon name="chevronDown" size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-3 border-t border-line p-3">
        <div>
          <p className="mb-1.5 text-2xs leading-relaxed text-mute">
            <strong className="text-ink">Montagem no ritmo:</strong> refaz a faixa com um plano por intervalo entre marcadores (use M ou “Marcar batidas” na aba Áudio). {markers < 2 ? 'Faltam marcadores.' : `${markers - 1} planos serão criados.`}
          </p>
          <button type="button" className="btn w-full" disabled={markers < 2 || !trackId || clips.length === 0} onClick={() => montage(trackId)} data-testid="montage-run">
            <Icon name="shuffle" size={14} /> Montar nos marcadores
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-2xs leading-relaxed text-mute">
            <strong className="text-ink">Encaixar na duração:</strong> muda a velocidade dos clipes selecionados (de 0,5× a 2×) para somarem o tempo desejado.
          </p>
          <div className="flex gap-1.5">
            <input className="field w-20" inputMode="decimal" aria-label="Duração-alvo em segundos" value={target} onChange={(e) => setTarget(e.target.value)} />
            <span className="flex items-center text-xs text-mute">s</span>
            <button type="button" className="btn flex-1" disabled={selection.length === 0} onClick={() => fit(Number(target.replace(',', '.')))} data-testid="fit-run">
              <Icon name="clock" size={14} /> Encaixar seleção
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
