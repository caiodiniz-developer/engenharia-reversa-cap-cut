import { stat } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip } from '@editor/core';
import { renderProject } from './run';
import { clip, makeFixture, type Fixture } from './testutil';

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture({ cena: { color: '202020', duration: 6, tone: 440 } });
}, 60_000);

/**
 * A interface estima o tamanho da exportação só de áudio com a conta "taxa × duração".
 * Este teste mede arquivos reais para garantir que a conta usada pela interface continua honesta.
 */
describe('tamanho real da exportação só de áudio', () => {
  const secs = 5;
  const sampleRate = 48000;

  async function sizeOf(audioOnly: 'wav' | 'mp3' | 'm4a'): Promise<number> {
    const p = addClip(f.project, f.videoTrackId, clip('cena', 0, secs));
    const out = await renderProject(p, { audioOnly }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, `tam-${audioOnly}`));
    return (await stat(out.file)).size;
  }

  it('WAV: bate com 44 bytes + duração × taxa × 4 (dentro de 0,5%)', async () => {
    const expected = 44 + secs * sampleRate * 4;
    const real = await sizeOf('wav');
    expect(Math.abs(real - expected) / expected).toBeLessThan(0.005);
  }, 120_000);

  it('MP3 a 192 kbit/s: dentro de 15% de duração × 24.000 bytes', async () => {
    const expected = secs * 24_000;
    const real = await sizeOf('mp3');
    expect(Math.abs(real - expected) / expected, `mp3: real=${real} esperado=${expected}`).toBeLessThan(0.15);
  }, 120_000);

  it('M4A (AAC) nunca passa da conta e costuma sair até ~25% menor', async () => {
    const expected = secs * 24_000;
    const real = await sizeOf('m4a');
    expect(real, `m4a: real=${real} esperado=${expected}`).toBeLessThanOrEqual(expected * 1.05);
    expect(real).toBeGreaterThan(expected * 0.6);
  }, 120_000);
});
