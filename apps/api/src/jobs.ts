import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { detectBeats, migrateProject, type Project } from '@editor/core';
import {
  createProxy,
  detectScenes,
  detectSilenceFfmpeg,
  energyEnvelope,
  extractAudioWav,
  extractThumbnail,
  RenderCancelled,
  renderProject,
  waveformPeaks,
  type RenderOptions,
} from '@editor/render';
import { pickHighlights } from './ai/highlights';
import type { AppContext } from './http';
import { NonRetryableError } from './queue';

export const AI_JOB_TYPES = ['ai.transcribe', 'ai.analyze'] as const;

/** Registra os handlers de tarefas na fila. */
export function registerJobs(ctx: AppContext): void {
  const { db, store, queue, events, config } = ctx;

  // ---- Pós-processamento de mídia: thumbnail, forma de onda e proxy ----
  queue.register(
    'media.process',
    'processing',
    async ({ job, progress }) => {
      const { mediaId } = job.payload as { mediaId: string };
      const media = await db.media.findUnique({ where: { id: mediaId } });
      if (!media) throw new NonRetryableError('Mídia removida');
      const base = `projects/${media.projectId}/media/${media.id}`;
      const src = store.localPath(media.storageKey);
      try {
        const patch: { thumbKey?: string; waveformKey?: string; proxyKey?: string } = {};
        if (media.kind !== 'audio') {
          const thumb = `${base}/thumb.jpg`;
          await mkdir(path.dirname(store.localPath(thumb)), { recursive: true });
          await extractThumbnail(src, store.localPath(thumb), media.kind === 'video' ? Math.min(1, media.duration / 2) : 0, 320);
          patch.thumbKey = thumb;
        }
        progress(0.2);
        if (media.hasAudio) {
          const peaks = await waveformPeaks(src, Math.min(4000, Math.max(200, Math.round(media.duration * 20))));
          const wf = `${base}/waveform.json`;
          await store.put(wf, Buffer.from(JSON.stringify(Array.from(peaks, (v) => Math.round(v * 1000) / 1000))));
          patch.waveformKey = wf;
        }
        progress(0.4);
        if (media.kind === 'video') {
          const proxy = `${base}/proxy.mp4`;
          await createProxy(src, store.localPath(proxy), 360);
          patch.proxyKey = proxy;
        }
        await db.media.update({ where: { id: media.id }, data: { ...patch, status: 'ready', error: null } });
        events.emit(media.ownerId, { type: 'media', mediaId: media.id, projectId: media.projectId, status: 'ready' });
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
        await db.media.update({ where: { id: media.id }, data: { status: 'failed', error: message } }).catch(() => {});
        events.emit(media.ownerId, { type: 'media', mediaId: media.id, projectId: media.projectId, status: 'failed', error: message });
        throw new NonRetryableError(message);
      }
      return { mediaId: media.id };
    },
    15 * 60_000,
  );

  // ---- Exportação ----
  queue.register(
    'export',
    'export',
    async ({ job, signal, progress }) => {
      const { exportId, project: snapshot, options } = job.payload as unknown as { exportId: string; project: unknown; options: RenderOptions };
      const project: Project = migrateProject(snapshot);
      const exp = await db.export.findUnique({ where: { id: exportId } });
      if (!exp) throw new NonRetryableError('Exportação removida');
      const mediaRows = await db.media.findMany({ where: { projectId: exp.projectId } });
      const byId = new Map(mediaRows.map((m) => [m.id, m]));
      const outDir = `projects/${exp.projectId}/exports/${exp.id}`;
      await mkdir(store.localPath(outDir), { recursive: true });
      try {
        const { file } = await renderProject(
          project,
          options,
          {
            tmpRoot: config.tmpDir,
            resolveMedia: (id) => {
              const m = byId.get(id);
              if (!m) throw new NonRetryableError(`Mídia ${id} não encontrada`);
              return store.localPath(m.storageKey);
            },
          },
          store.localPath(`${outDir}/output`),
          { signal, onProgress: progress },
        );
        const key = `${outDir}/${path.basename(file)}`;
        const size = (await stat(file)).size;
        await db.export.update({
          where: { id: exp.id },
          data: { outputKey: key, sizeBytes: BigInt(size), expiresAt: new Date(Date.now() + config.EXPORT_RETENTION_HOURS * 3600_000) },
        });
        return { exportId: exp.id, outputKey: key, sizeBytes: size };
      } catch (err) {
        await store.deletePrefix(outDir).catch(() => {});
        if (err instanceof RenderCancelled) throw err;
        if (err instanceof Error && /vazio|não encontrada/.test(err.message)) throw new NonRetryableError(err.message);
        throw err;
      }
    },
    config.EXPORT_TIMEOUT_SECONDS * 1000,
  );

  // ---- IA: transcrição ----
  queue.register(
    'ai.transcribe',
    'ai',
    async ({ job, signal, progress }) => {
      const { mediaId, language } = job.payload as { mediaId: string; language?: string };
      const media = await db.media.findUnique({ where: { id: mediaId } });
      if (!media || !media.hasAudio) throw new NonRetryableError('A mídia não possui áudio para transcrever');
      const dir = path.join(config.tmpDir, `tr-${job.id}`);
      await mkdir(dir, { recursive: true });
      try {
        const wav = path.join(dir, 'audio.wav');
        await extractAudioWav(store.localPath(media.storageKey), wav);
        progress(0.2);
        const transcript = await ctx.ai.transcribe(wav, { language, signal });
        return { mediaId, ...transcript };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    60 * 60_000,
  );

  // ---- IA/áudio: análises locais (sem enviar dados a terceiros) ----
  queue.register(
    'ai.analyze',
    'ai',
    async ({ job, progress }) => {
      const p = job.payload as { mediaId: string; kind: 'silence' | 'scenes' | 'beats' | 'cuts' | 'highlights'; noiseDb?: number; minDuration?: number; threshold?: number; targetSeconds?: number };
      const media = await db.media.findUnique({ where: { id: p.mediaId } });
      if (!media) throw new NonRetryableError('Mídia removida');
      const file = store.localPath(media.storageKey);
      switch (p.kind) {
        case 'silence':
          return { silences: await detectSilenceFfmpeg(file, { noiseDb: p.noiseDb, minDuration: p.minDuration }) };
        case 'scenes':
          return { scenes: await detectScenes(file, p.threshold) };
        case 'beats': {
          const energy = await energyEnvelope(file, 0.05);
          return { beats: detectBeats(energy, 0.05) };
        }
        case 'cuts': {
          // Sugestão de cortes: remover silêncios e marcar trocas de cena como pontos de corte candidatos.
          const silences = media.hasAudio ? await detectSilenceFfmpeg(file, { noiseDb: p.noiseDb, minDuration: p.minDuration ?? 0.6 }) : [];
          progress(0.5);
          const scenes = media.kind === 'video' ? await detectScenes(file, p.threshold) : [];
          return { silences, scenes, method: 'heuristic: silencedetect + scene score' };
        }
        case 'highlights': {
          const silences = media.hasAudio ? await detectSilenceFfmpeg(file, { noiseDb: p.noiseDb, minDuration: 0.5 }) : [];
          progress(0.3);
          const scenes = media.kind === 'video' ? await detectScenes(file, 0.35) : [];
          progress(0.6);
          const windowSec = 0.5;
          const raw = media.hasAudio ? await energyEnvelope(file, windowSec) : [];
          const max = Math.max(1e-6, ...raw);
          const energy = raw.map((v) => v / max);
          const highlights = pickHighlights({ duration: media.duration, silences, energy, windowSec, scenes, targetSeconds: p.targetSeconds ?? 30 });
          return { highlights, method: 'heuristic: audio energy + scene changes (suggestion only)' };
        }
      }
    },
    30 * 60_000,
  );

}

/** Remove exportações expiradas e uploads abandonados. Retorna quantas exportações foram limpas. */
export async function runRetention(ctx: AppContext, now = new Date()): Promise<number> {
  const expired = await ctx.db.export.findMany({ where: { expiresAt: { lt: now }, outputKey: { not: null } } });
  for (const e of expired) {
    if (e.outputKey) await ctx.store.delete(e.outputKey).catch(() => {});
    await ctx.db.export.update({ where: { id: e.id }, data: { outputKey: null, sizeBytes: null } });
  }
  return expired.length;
}
