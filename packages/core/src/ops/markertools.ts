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
