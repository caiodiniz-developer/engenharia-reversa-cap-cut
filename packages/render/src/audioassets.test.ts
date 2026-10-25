import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip, addTrack } from '@editor/core';
import { ffmpegRun, waveformPeaks } from './media';
import { renderProject } from './run';
import { probeMedia } from './probe';
import { clip, makeFixture, registerMedia, type Fixture } from './testutil';

let f: Fixture;

beforeAll(async () => {
  f = await makeFixture({ cena: { color: '202020', duration: 4 } });
  const wav = path.join(f.dir, 'tom.wav');
  await ffmpegRun(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', wav]);
  f.files.tom = wav;
  f.project = await registerMedia(f.project, 'tom', wav);
}, 120_000);

describe('mídia só de áudio (arquivo de áudio importado ou voz gravada)', () => {
  it('é registrada como áudio e entra na mixagem da exportação', async () => {
    expect(f.project.media.tom!.kind).toBe('audio');
    let p = addClip(f.project, f.videoTrackId, clip('cena', 0, 4));
    const a = addTrack(p, 'audio');
    p = addClip(a.project, a.track.id, clip('tom', 0, 3));
    const out = await renderProject(p, { preset: 'ultrafast' }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, 'com-audio.mp4'));
    const peaks = await waveformPeaks(out.file, 400);
    const loud = Math.max(...Array.from(peaks.slice(40, 260)));
    expect(loud).toBeGreaterThan(0.05);
    // depois dos 3 s o áudio acaba
    expect(Math.max(...Array.from(peaks.slice(330, 400)))).toBeLessThan(0.02);
  }, 120_000);

  it('exportação só de áudio: MP3, WAV e M4A sem vídeo, com a duração do projeto e som audível', async () => {
    let p = addClip(f.project, f.videoTrackId, clip('cena', 0, 4));
    const a = addTrack(p, 'audio');
    p = addClip(a.project, a.track.id, clip('tom', 0, 3));
    for (const [fmt, codec] of [['mp3', 'mp3'], ['wav', 'pcm_s16le'], ['m4a', 'aac']] as const) {
      const out = await renderProject(p, { audioOnly: fmt }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, `so-audio-${fmt}`));
      expect(out.file.endsWith(`.${fmt}`)).toBe(true);
      const info = await probeMedia(out.file);
      expect(info.kind, fmt).toBe('audio');
      expect(info.videoCodec, fmt).toBeUndefined();
      expect(info.audioCodec, fmt).toBe(codec);
      expect(info.duration, fmt).toBeGreaterThan(3.8);
      expect(info.duration, fmt).toBeLessThan(4.3);
      const peaks = await waveformPeaks(out.file, 400);
      expect(Math.max(...Array.from(peaks.slice(40, 260))), fmt).toBeGreaterThan(0.05);
    }
  }, 180_000);

  it('exportação só de áudio respeita o intervalo selecionado', async () => {
    let p = addClip(f.project, f.videoTrackId, clip('cena', 0, 4));
    const a = addTrack(p, 'audio');
    p = addClip(a.project, a.track.id, clip('tom', 0, 3));
    const out = await renderProject(p, { audioOnly: 'wav', range: { start: 1, end: 2.5 } }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, 'so-audio-range'));
    const info = await probeMedia(out.file);
    expect(info.duration).toBeGreaterThan(1.4);
    expect(info.duration).toBeLessThan(1.6);
  }, 120_000);
});
