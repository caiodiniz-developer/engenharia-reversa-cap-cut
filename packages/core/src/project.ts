import { newId } from './ids';
import { round6, clipEnd } from './time';
import {
  SCHEMA_VERSION,
  ProjectSchema,
  ProjectSettingsSchema,
  type Clip,
  type MediaAsset,
  type Project,
  type ProjectSettings,
  type Track,
} from './schema';

export function createProject(name = 'Projeto sem título', settings: Partial<ProjectSettings> = {}): Project {
  return {
    version: SCHEMA_VERSION,
    id: newId('prj'),
    name,
    settings: ProjectSettingsSchema.parse(settings),
    media: {},
    tracks: [],
    markers: [],
  };
}

/** Valida um objeto desconhecido como projeto (lança ZodError se inválido). */
export function parseProject(raw: unknown): Project {
  return ProjectSchema.parse(raw);
}

export function projectDuration(p: Project): number {
  let end = 0;
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, clipEnd(c));
  return round6(end);
}

export function findTrack(p: Project, trackId: string): Track | undefined {
  return p.tracks.find((t) => t.id === trackId);
}

export function findClip(p: Project, clipId: string): { track: Track; clip: Clip; trackIndex: number } | undefined {
  for (let i = 0; i < p.tracks.length; i++) {
    const track = p.tracks[i]!;
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip, trackIndex: i };
  }
  return undefined;
}

export function allClips(p: Project): Array<{ track: Track; clip: Clip }> {
  return p.tracks.flatMap((track) => track.clips.map((clip) => ({ track, clip })));
}

export function addMedia(p: Project, asset: MediaAsset): Project {
  return { ...p, media: { ...p.media, [asset.id]: asset } };
}

export function removeMedia(p: Project, mediaId: string): Project {
  const media = { ...p.media };
  delete media[mediaId];
  return {
    ...p,
    media,
    tracks: p.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => !(c.type === 'media' && c.mediaId === mediaId)),
    })),
  };
}

export function renameProject(p: Project, name: string): Project {
  return { ...p, name };
}

export function setSettings(p: Project, patch: Partial<ProjectSettings>): Project {
  return { ...p, settings: ProjectSettingsSchema.parse({ ...p.settings, ...patch }) };
}
