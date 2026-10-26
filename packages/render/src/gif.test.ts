import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip } from '@editor/core';
import { probeMedia } from './probe';
import { renderProject } from './run';
import { clip, makeFixture, near, pixelAt, type Fixture } from './testutil';

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture({ vermelho: { color: 'ff0000', duration: 3, tone: 440 } });
}, 60_000);

describe('exportação em GIF', () => {
  it('gera um GIF animado sem áudio, no tamanho e fps pedidos, com as cores do vídeo', async () => {
    const p = addClip(f.project, f.videoTrackId, clip('vermelho', 0, 2));
    const out = await renderProject(p, { gif: true, width: 160, height: 90, fps: 10 }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, 'animado'));
    expect(out.file.endsWith('.gif')).toBe(true);
    const info = await probeMedia(out.file);
    expect(info).toMatchObject({ videoCodec: 'gif', width: 160, height: 90, hasAudio: false });
    expect(info.duration).toBeGreaterThan(1.8);
    expect(info.duration).toBeLessThan(2.3);
    expect(info.fps).toBeCloseTo(10, 0);
    const center = await pixelAt(out.file, 1, 80, 45);
    expect(near(center, [255, 0, 0], 40), `centro ${center}`).toBe(true);
  }, 120_000);

  it('o fps padrão do GIF é 15 e um intervalo é respeitado', async () => {
    const p = addClip(f.project, f.videoTrackId, clip('vermelho', 0, 3));
    const out = await renderProject(p, { gif: true, width: 96, height: 54, range: { start: 1, end: 2 } }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, 'trecho'));
    const info = await probeMedia(out.file);
    expect(info.fps).toBeCloseTo(15, 0);
    expect(info.duration).toBeGreaterThan(0.85);
    expect(info.duration).toBeLessThan(1.2);
  }, 120_000);
});
