import path from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';
import { removeRanges, setSpeed, setTransition } from '@editor/core';
import { renderProject } from './run';
import { probeMedia } from './probe';
import { clip, makeFixture, near, pixelAt, withClips, type Fixture } from './testutil';

let f: Fixture;
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];

async function render(project: Parameters<typeof renderProject>[0], name: string, opts: Parameters<typeof renderProject>[1] = {}) {
  const env = { resolveMedia: (id: string) => f.files[id]!, tmpRoot: f.dir };
  return renderProject(project, { preset: 'ultrafast', ...opts }, env, path.join(f.dir, name));
}

beforeAll(async () => {
  f = await makeFixture({
    red: { color: 'ff0000', duration: 4, tone: 440 },
    green: { color: '00ff00', duration: 4, tone: 880 },
    blue: { color: '0000ff', duration: 4 },
  });
}, 120_000);

describe('exportação real', () => {
  it('concatena clipes em sequência com duração, resolução e fps corretos', async () => {
    const p = withClips(f, [clip('red', 0, 2), clip('green', 2, 2), clip('blue', 4, 2)]);
    const { file } = await render(p, 'seq');
    const info = await probeMedia(file);
    expect(info.width).toBe(320);
    expect(info.height).toBe(180);
    expect(info.fps).toBeCloseTo(30, 1);
    expect(info.duration).toBeGreaterThan(5.9);
    expect(info.duration).toBeLessThan(6.1);
    expect(info.hasAudio).toBe(true);
    expect(near(await pixelAt(file, 1, 160, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 3, 160, 90), GREEN)).toBe(true);
    expect(near(await pixelAt(file, 5, 160, 90), BLUE)).toBe(true);
  }, 120_000);

  it('respeita corte, divisão e remoção de trecho (ripple)', async () => {
    const a = clip('red', 0, 3);
    const b = clip('green', 3, 3);
    let p = withClips(f, [a, b]);
    // remove 1s..2s do vermelho: o verde começa em 2s
    p = removeRanges(p, a.id, [{ start: 1, end: 2 }]);
    const { file } = await render(p, 'ripple');
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(4.9);
    expect(info.duration).toBeLessThan(5.1);
    expect(near(await pixelAt(file, 1.5, 160, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 2.5, 160, 90), GREEN)).toBe(true);
  }, 120_000);

  it('velocidade 2x reduz a duração exportada', async () => {
    const c = clip('red', 0, 4);
    const p = setSpeed(withClips(f, [c]), c.id, 2);
    const { file } = await render(p, 'speed');
    const info = await probeMedia(file);
    expect(info.duration).toBeGreaterThan(1.9);
    expect(info.duration).toBeLessThan(2.1);
  }, 120_000);

  it('aplica a transição fade: ponto médio mistura as cores', async () => {
    const a = clip('red', 0, 3);
    const b = clip('blue', 3, 3);
    let p = withClips(f, [a, b]);
    p = setTransition(p, b.id, 'fade', 1);
    const { file, plan } = await render(p, 'fade');
    const info = await probeMedia(file);
    expect(plan.duration).toBeCloseTo(5, 1);
    expect(info.duration).toBeGreaterThan(4.9);
    expect(info.duration).toBeLessThan(5.15);
    // transição ocupa [2, 3]: no meio (2.5s) há vermelho e azul
    const mid = await pixelAt(file, 2.5, 160, 90);
    expect(mid[0]).toBeGreaterThan(60);
    expect(mid[2]).toBeGreaterThan(60);
    expect(near(await pixelAt(file, 1, 160, 90), RED)).toBe(true);
    expect(near(await pixelAt(file, 4, 160, 90), BLUE)).toBe(true);
  }, 120_000);
});
