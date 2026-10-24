import path from 'node:path';
import {
  addClip,
  addMedia,
  addTrack,
  MediaClipSchema,
  newId,
  parseProject,
  type MediaAsset,
  type Project,
} from '@editor/core';
import { generateTestVideo } from '@editor/render';
import type { TestApp, TestUser } from './harness';

export async function makeVideo(dir: string, name: string, opts: { duration: number; color?: string; tone?: number }): Promise<string> {
  const file = path.join(dir, name);
  await generateTestVideo(file, { width: 320, height: 180, ...opts });
  return file;
}

export async function createProjectFor(user: TestUser, name = 'Projeto') {
  const res = await user.post('/api/projects', { name });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return { id: res.body.project.id as string, revision: res.body.project.revision as number, data: parseProject(res.body.project.data) };
}

/** Envia o arquivo, espera o processamento e devolve o registro da mídia pronto. */
export async function uploadMedia(t: TestApp, user: TestUser, projectId: string, file: string, mime = 'video/mp4') {
  const res = await t.http.post(`/api/projects/${projectId}/media`).set(user.auth).attach('file', file, { contentType: mime });
  if (res.status !== 201) throw new Error(`upload falhou ${res.status}: ${JSON.stringify(res.body)}`);
  await t.built.ctx.queue.onIdle();
  const media = await user.get(`/api/media/${res.body.media.id}`);
  return media.body.media as {
    id: string; name: string; kind: string; duration: number; width: number; height: number; fps: number; hasAudio: boolean; size: number; mime: string; status: string;
    urls: { original: string; proxy: string | null; thumb: string | null; waveform: string | null };
  };
}

export function assetOf(m: Awaited<ReturnType<typeof uploadMedia>>): MediaAsset {
  return { id: m.id, name: m.name, kind: m.kind as MediaAsset['kind'], duration: m.duration, width: m.width, height: m.height, fps: m.fps, hasAudio: m.hasAudio, size: m.size, mime: m.mime };
}

/** Monta um documento com os clipes dados em sequência numa faixa de vídeo. */
export function sequenceDoc(base: Project, clips: Array<{ asset: MediaAsset; duration: number }>): Project {
  let p = base;
  for (const c of clips) p = addMedia(p, c.asset);
  const r = addTrack(p, 'video');
  p = r.project;
  let t = 0;
  for (const c of clips) {
    p = addClip(p, r.track.id, MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId: c.asset.id, start: t, duration: c.duration }));
    t += c.duration;
  }
  return p;
}
