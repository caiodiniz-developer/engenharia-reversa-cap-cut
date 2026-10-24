import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Marker, Project, Track, TrackKind } from '../schema';
import { round6 } from '../time';

const DEFAULT_NAMES: Record<TrackKind, string> = {
  video: 'Vídeo',
  audio: 'Áudio',
  text: 'Texto',
  caption: 'Legendas',
};

/**
 * Adiciona uma faixa. Se index for omitido, a faixa entra na posição natural do tipo:
 * vídeo/texto/legenda ficam acima das faixas de áudio (índice 0 = camada superior).
 */
export function addTrack(p: Project, kind: TrackKind, opts: { index?: number; name?: string } = {}): { project: Project; track: Track } {
  const count = p.tracks.filter((t) => t.kind === kind).length + 1;
  const track: Track = {
    id: newId('trk'),
    kind,
    name: opts.name ?? `${DEFAULT_NAMES[kind]} ${count}`,
    locked: false,
    hidden: false,
    muted: false,
    clips: [],
  };
  const tracks = [...p.tracks];
  let index = opts.index;
  if (index === undefined) {
    if (kind === 'audio') index = tracks.length;
    else {
      const firstAudio = tracks.findIndex((t) => t.kind === 'audio');
      index = kind === 'video' ? (firstAudio === -1 ? tracks.length : firstAudio) : 0;
    }
  }
  tracks.splice(Math.max(0, Math.min(index, tracks.length)), 0, track);
  return { project: { ...p, tracks }, track };
}

export function removeTrack(p: Project, trackId: string): Project {
  if (!p.tracks.some((t) => t.id === trackId)) throw new TimelineError('Faixa não encontrada', 'NOT_FOUND');
  return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
}

export function moveTrack(p: Project, trackId: string, newIndex: number): Project {
  const from = p.tracks.findIndex((t) => t.id === trackId);
  if (from === -1) throw new TimelineError('Faixa não encontrada', 'NOT_FOUND');
  const tracks = [...p.tracks];
  const [t] = tracks.splice(from, 1);
  tracks.splice(Math.max(0, Math.min(newIndex, tracks.length)), 0, t!);
  return { ...p, tracks };
}

export function setTrackProps(
  p: Project,
  trackId: string,
  patch: Partial<Pick<Track, 'name' | 'locked' | 'hidden' | 'muted'>>,
): Project {
  if (!p.tracks.some((t) => t.id === trackId)) throw new TimelineError('Faixa não encontrada', 'NOT_FOUND');
  return { ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)) };
}

export function addMarker(p: Project, time: number, label = '', color = '#f5a524'): { project: Project; marker: Marker } {
  const marker: Marker = { id: newId('mk'), time: round6(Math.max(0, time)), label, color };
  const markers = [...p.markers, marker].sort((a, b) => a.time - b.time);
  return { project: { ...p, markers }, marker };
}

export function removeMarker(p: Project, markerId: string): Project {
  return { ...p, markers: p.markers.filter((m) => m.id !== markerId) };
}

export function updateMarker(p: Project, markerId: string, patch: Partial<Pick<Marker, 'time' | 'label' | 'color'>>): Project {
  const markers = p.markers
    .map((m) => (m.id === markerId ? { ...m, ...patch, time: round6(Math.max(0, patch.time ?? m.time)) } : m))
    .sort((a, b) => a.time - b.time);
  return { ...p, markers };
}
