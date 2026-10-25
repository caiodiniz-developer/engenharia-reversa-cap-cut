import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { addClip, addTrack, setSettings } from '@editor/core';
import { renderShapePng } from './generated';
import { renderProject } from './run';
import { clip, makeFixture, near, pixelAt, registerMedia, type Fixture } from './testutil';

let f: Fixture;

beforeAll(async () => {
  f = await makeFixture({ cena: { color: '202020', duration: 3 } });
  const file = path.join(f.dir, 'circulo.png');
  await writeFile(file, renderShapePng({ shape: 'circle', color: '#ff0000', size: 512 }));
  f.files.circulo = file;
  f.project = await registerMedia(f.project, 'circulo', file);
}, 60_000);

describe('forma gerada na exportação', () => {
  it('a transparência é preservada: centro na cor da forma, canto mostra o fundo do projeto', async () => {
    let p = setSettings(f.project, { background: '#0000ff' });
    const t = addTrack(p, 'video'); // faixa nova fica acima da anterior
    p = addClip(t.project, t.track.id, clip('circulo', 0, 2));
    const out = await renderProject(p, { preset: 'ultrafast' }, { resolveMedia: (id) => f.files[id]!, tmpRoot: f.dir }, path.join(f.dir, 'forma.mp4'));
    // a forma é "contida" no quadro 320x180: o círculo ocupa ~84% da altura, centrado
    const center = await pixelAt(out.file, 1, 160, 90);
    const corner = await pixelAt(out.file, 1, 6, 6);
    expect(near(center, [255, 0, 0], 40), `centro ${center}`).toBe(true);
    expect(near(corner, [0, 0, 255], 40), `canto ${corner}`).toBe(true);
  }, 120_000);
});
