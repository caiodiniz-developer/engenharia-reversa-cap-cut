import { TimelineError } from '../errors';
import { newId } from '../ids';
import { allClips, projectDuration } from '../project';
import type { Marker, Project, Track } from '../schema';
import { clipEnd, round6 } from '../time';
import { requireTrack } from './helpers';

const sortMarkers = (ms: Marker[]) => [...ms].sort((a, b) => a.time - b.time);
const hasMarkerAt = (ms: Marker[], t: number) => ms.some((m) => Math.abs(m.time - t) < 1e-3);

/** Põe um marcador a cada ${seconds} s até o fim do projeto (sem repetir marcadores que já existam). No máximo 500. */
export function markersEvery(p: Project, seconds: number, label = 'Marca'): { project: Project; added: number } {
  if (!(seconds >= 0.1)) throw new TimelineError('O intervalo mínimo é 0,1 s', 'OUT_OF_RANGE');
  const end = projectDuration(p);
  if (end <= 0) throw new TimelineError('O projeto está vazio', 'OUT_OF_RANGE');
  if (end / seconds > 500) throw new TimelineError('Isso criaria marcadores demais (máximo 500)', 'OUT_OF_RANGE');
  let markers = p.markers;
  let added = 0;
  for (let k = 1; k * seconds < end - 1e-6; k++) {
    const time = round6(k * seconds);
    if (hasMarkerAt(markers, time)) continue;
    markers = [...markers, { id: newId('mk'), time, label: label + ' ' + k, color: '#f5a524' }];
    added++;
  }
  return { project: { ...p, markers: sortMarkers(markers) }, added };
}

/** Põe um marcador no início de cada clipe de mídia (ou só dos ids), com o nome do arquivo; pula onde já há marcador. */
export function markersAtClipStarts(p: Project, ids?: string[]): { project: Project; added: number } {
  const only = ids ? new Set(ids) : null;
  let markers = p.markers;
  let added = 0;
  const starts = allClips(p)
    .filter(({ clip }) => clip.type === 'media' && (!only || only.has(clip.id)) && p.media[clip.mediaId]?.kind !== 'audio')
    .map(({ clip }) => ({ time: clip.start, label: clip.type === 'media' ? (p.media[clip.mediaId]?.name ?? '') : '' }))
    .sort((a, b) => a.time - b.time);
  for (const s of starts) {
    if (hasMarkerAt(markers, s.time)) continue;
    markers = [...markers, { id: newId('mk'), time: round6(s.time), label: s.label, color: '#f5a524' }];
    added++;
  }
  return { project: { ...p, markers: sortMarkers(markers) }, added };
}

/** Marca o começo de cada vão (trecho sem nenhum clipe em nenhuma faixa) maior que ${minGap} s, entre 0 e o fim do projeto. */
export function markersAtGaps(p: Project, minGap = 0.1): { project: Project; added: number } {
  const spans = allClips(p)
    .map(({ clip }) => [clip.start, clipEnd(clip)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const gaps: Array<[number, number]> = [];
  let cursor = 0;
  for (const [a, b] of spans) {
    if (a - cursor >= minGap) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  let markers = p.markers;
  let added = 0;
  for (const [a, b] of gaps) {
    if (hasMarkerAt(markers, a)) continue;
    markers = [...markers, { id: newId('mk'), time: round6(a), label: 'Vão de ' + round6(b - a) + ' s', color: '#e5484d' }];
    added++;
  }
  return { project: { ...p, markers: sortMarkers(markers) }, added };
}

/** Remove os marcadores do trecho [from, to] (ou todos, sem trecho). */
export function clearMarkers(p: Project, range?: { from: number; to: number }): { project: Project; removed: number } {
  const keep = range ? p.markers.filter((m) => m.time < range.from - 1e-6 || m.time > range.to + 1e-6) : [];
  return { project: { ...p, markers: keep }, removed: p.markers.length - keep.length };
}

/** Desloca os marcadores (todos ou só os ids) por ${delta} segundos, sem passar de 0. */
export function shiftMarkers(p: Project, delta: number, ids?: string[]): Project {
  if (!Number.isFinite(delta)) throw new TimelineError('Deslocamento inválido', 'INVALID');
  const only = ids ? new Set(ids) : null;
  return { ...p, markers: sortMarkers(p.markers.map((m) => (!only || only.has(m.id) ? { ...m, time: round6(Math.max(0, m.time + delta)) } : m))) };
}
