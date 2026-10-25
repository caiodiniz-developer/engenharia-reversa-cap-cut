import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip, addTrack } from '@editor/core';
import { ffmpegRun, waveformPeaks } from './media';
import { renderProject } from './run';
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
});
