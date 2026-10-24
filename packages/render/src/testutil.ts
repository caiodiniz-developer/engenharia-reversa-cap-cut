import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  addClip,
  addMedia,
  addTrack,
  createProject,
  MediaClipSchema,
  newId,
  type MediaAsset,
  type MediaClip,
  type Project,
} from '@editor/core';
import { extractFrame, generateTestVideo } from './media';
import { probeMedia } from './probe';

export interface Fixture {
  dir: string;
  files: Record<string, string>;
  project: Project;
  videoTrackId: string;
}

export async function makeTmp(prefix = 'editor-test-'): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Cria vídeos de cor sólida (com tom de áudio) e um projeto 320x180@30 que os referencia. */
export async function makeFixture(
  colors: Record<string, { color: string; duration: number; tone?: number }>,
  settings: { width?: number; height?: number; fps?: number } = {},
): Promise<Fixture> {
  const dir = await makeTmp();
  const files: Record<string, string> = {};
  let project = createProject('render-test', { width: 320, height: 180, fps: 30, ...settings });
  for (const [id, spec] of Object.entries(colors)) {
    const file = path.join(dir, `${id}.mp4`);
    await generateTestVideo(file, { duration: spec.duration, color: spec.color, tone: spec.tone, width: 320, height: 180 });
    files[id] = file;
    const pr = await probeMedia(file);
    const asset: MediaAsset = {
      id,
      name: `${id}.mp4`,
      kind: 'video',
      duration: pr.duration,
      width: pr.width,
      height: pr.height,
      fps: pr.fps,
      hasAudio: pr.hasAudio,
      size: pr.size,
      mime: 'video/mp4',
    };
    project = addMedia(project, asset);
  }
  const r = addTrack(project, 'video');
  return { dir, files, project: r.project, videoTrackId: r.track.id };
}

export function clip(mediaId: string, start: number, duration: number, extra: Partial<MediaClip> = {}): MediaClip {
  return MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId, start, duration, ...extra });
}

export function withClips(f: Fixture, clips: MediaClip[]): Project {
  return clips.reduce((p, c) => addClip(p, f.videoTrackId, c), f.project);
}

/** Lê o pixel RGB do quadro em `time` da saída renderizada. */
export async function pixelAt(file: string, time: number, x: number, y: number): Promise<[number, number, number]> {
  const out = path.join(await makeTmp('frame-'), 'f.png');
  await extractFrame(file, out, time);
  const img = await loadImage(out);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

export const near = (a: number[], b: number[], tol = 24): boolean => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

/** Registra um arquivo existente como mídia do projeto (via ffprobe). */
export async function registerMedia(project: Project, id: string, file: string): Promise<Project> {
  const pr = await probeMedia(file);
  const asset: MediaAsset = {
    id,
    name: path.basename(file),
    kind: pr.kind,
    duration: pr.duration,
    width: pr.width,
    height: pr.height,
    fps: pr.fps,
    hasAudio: pr.hasAudio,
    size: pr.size,
    mime: '',
  };
  return addMedia(project, asset);
}

/** Quadro completo como ImageData RGBA. */
export async function frameData(file: string, time: number): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const out = path.join(await makeTmp('frame-'), 'f.png');
  await extractFrame(file, out, time);
  const img = await loadImage(out);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height);
  return { data: d.data, width: img.width, height: img.height };
}

/** Conta pixels que satisfazem o predicado. */
export function countPixels(f: { data: Uint8ClampedArray }, pred: (r: number, g: number, b: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < f.data.length; i += 4) if (pred(f.data[i]!, f.data[i + 1]!, f.data[i + 2]!)) n++;
  return n;
}
