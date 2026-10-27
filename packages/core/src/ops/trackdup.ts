import { newId } from '../ids';
import type { Clip, Project, Track } from '../schema';
import { requireTrack } from './helpers';

/**
 * Duplica uma faixa com todos os clipes (ids novos), logo abaixo da original.
 * Ligações (vídeo + áudio) e grupos viram novos dentro da cópia, para não se misturarem com os da original.
 */
export function duplicateTrack(p: Project, trackId: string): { project: Project; track: Track } {
  const src = requireTrack(p, trackId);
  const links = new Map<string, string>();
  const groups = new Map<string, string>();
  const remap = (map: Map<string, string>, id: string | undefined, prefix: string) => (id ? (map.get(id) ?? (map.set(id, newId(prefix)), map.get(id)!)) : undefined);
  const clips = src.clips.map((c) => {
    const copy: Clip = JSON.parse(JSON.stringify(c));
    copy.id = newId('clp');
    copy.linkId = remap(links, c.linkId, 'lnk');
    copy.groupId = remap(groups, c.groupId, 'grp');
    if (copy.type === 'media') copy.effects = copy.effects.map((e) => ({ ...e, id: newId('fx') }));
    return copy;
  });
  const track: Track = { ...JSON.parse(JSON.stringify(src)), id: newId('trk'), name: `${src.name} (cópia)`, locked: false, clips };
  const index = p.tracks.findIndex((t) => t.id === trackId);
  const tracks = [...p.tracks.slice(0, index + 1), track, ...p.tracks.slice(index + 1)];
  return { project: { ...p, tracks }, track };
}
