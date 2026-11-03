import { allClips, projectDuration } from './project';
import type { Project } from './schema';
import { usedMediaIds } from './usage';

export interface ProjectStats {
  duration: number;
  tracks: number;
  clips: { video: number; image: number; audio: number; text: number; caption: number; total: number };
  media: { imported: number; used: number; unused: number; usedBytes: number };
  markers: number;
  /** Palavras em textos e legendas. */
  words: number;
  longest: { id: string; duration: number } | null;
  shortest: { id: string; duration: number } | null;
  /** Duração média dos clipes (s); 0 se não houver. */
  averageClip: number;
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Resume o projeto em números: serve ao diálogo "Estatísticas do projeto". */
export function projectStats(p: Project): ProjectStats {
  const clips = { video: 0, image: 0, audio: 0, text: 0, caption: 0, total: 0 };
  let words = 0;
  let longest: ProjectStats['longest'] = null;
  let shortest: ProjectStats['shortest'] = null;
  let sum = 0;
  for (const { clip } of allClips(p)) {
    clips.total++;
    sum += clip.duration;
    if (!longest || clip.duration > longest.duration) longest = { id: clip.id, duration: clip.duration };
    if (!shortest || clip.duration < shortest.duration) shortest = { id: clip.id, duration: clip.duration };
    if (clip.type === 'media') clips[p.media[clip.mediaId]?.kind ?? 'video']++;
    else {
      clips[clip.type]++;
      words += countWords(clip.text);
    }
  }
  const used = usedMediaIds(p);
  const imported = Object.keys(p.media).length;
  let usedBytes = 0;
  for (const id of used) usedBytes += p.media[id]?.size ?? 0;
  return {
    duration: projectDuration(p),
    tracks: p.tracks.length,
    clips,
    media: { imported, used: [...used].filter((id) => p.media[id]).length, unused: Object.keys(p.media).filter((id) => !used.has(id)).length, usedBytes },
    markers: p.markers.length,
    words,
    longest,
    shortest,
    averageClip: clips.total ? Math.round((sum / clips.total) * 1e6) / 1e6 : 0,
  };
}


export interface SelectionStats {
  count: number;
  /** Início do primeiro e fim do último clipe selecionado. */
  from: number;
  to: number;
  /** Tempo coberto entre o início do primeiro e o fim do último (inclui vãos). */
  span: number;
  /** Soma das durações dos clipes selecionados. */
  total: number;
}

/** Resume uma seleção de clipes (ids que não existem mais são ignorados). Devolve null se nada restou. */
export function selectionStats(p: Project, ids: Iterable<string>): SelectionStats | null {
  const chosen = new Set(ids);
  let count = 0;
  let from = Infinity;
  let to = -Infinity;
  let total = 0;
  for (const { clip } of allClips(p)) {
    if (!chosen.has(clip.id)) continue;
    count++;
    from = Math.min(from, clip.start);
    to = Math.max(to, clip.start + clip.duration);
    total += clip.duration;
  }
  if (!count) return null;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { count, from: round(from), to: round(to), span: round(to - from), total: round(total) };
}
