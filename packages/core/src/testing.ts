import { newId } from './ids';
import { createProject, addMedia } from './project';
import { addClip } from './ops/clips';
import { addTrack } from './ops/tracks';
import type { MediaAsset, MediaClip, Project } from './schema';
import { MediaClipSchema } from './schema';

export const videoAsset = (id = 'm1', duration = 10): MediaAsset => ({
  id,
  name: `${id}.mp4`,
  kind: 'video',
  duration,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  size: 1000,
  mime: 'video/mp4',
});

export function mediaClip(mediaId: string, start: number, duration: number, extra: Partial<MediaClip> = {}): MediaClip {
  return MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId, start, duration, ...extra });
}

/** Projeto com um asset de vídeo (10s) e uma faixa de vídeo. */
export function fixtureProject(): { project: Project; trackId: string } {
  let p = createProject('teste', { fps: 30 });
  p = addMedia(p, videoAsset('m1', 10));
  p = addMedia(p, videoAsset('m2', 10));
  const r = addTrack(p, 'video');
  return { project: r.project, trackId: r.track.id };
}

export { addClip };
