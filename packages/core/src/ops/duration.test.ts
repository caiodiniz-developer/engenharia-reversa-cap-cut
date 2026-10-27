import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { findClip } from '../project';
import { addMedia } from '../project';
import { TextClipSchema, type MediaAsset } from '../schema';
import { addClip, fixtureProject, mediaClip, videoAsset } from '../testing';
import { addTrack } from './tracks';
import { setClipsDuration } from './duration';

const image = (id: string): MediaAsset => ({ ...videoAsset(id, 5), kind: 'image', hasAudio: false, name: `${id}.png` });

function stills() {
  let { project, trackId } = fixtureProject();
  project = addMedia(project, image('i1'));
  const a = mediaClip('i1', 0, 5);
  const b = mediaClip('i1', 5, 5);
  let p = addClip(addClip(project, trackId, a), trackId, b);
  const tt = addTrack(p, 'text');
  const txt = TextClipSchema.parse({ id: newId('clp'), type: 'text', start: 1, duration: 2, text: 'Oi' });
  p = addClip(tt.project, tt.track.id, txt);
  return { p, a, b, txt, trackId };
}

describe('setClipsDuration', () => {
  it('dá a mesma duração a imagens e textos, mantendo o início de cada um', () => {
    const { p, a, b, txt } = stills();
    const out = setClipsDuration(p, [a.id, b.id, txt.id], 3);
    expect(findClip(out, a.id)!.clip).toMatchObject({ start: 0, duration: 3 });
    expect(findClip(out, b.id)!.clip).toMatchObject({ start: 5, duration: 3 });
    expect(findClip(out, txt.id)!.clip).toMatchObject({ start: 1, duration: 3 });
  });

  it('pode esticar quando há espaço livre (imagem não tem limite de origem)', () => {
    const { p, b } = stills();
    expect(findClip(setClipsDuration(p, [b.id], 20), b.id)!.clip.duration).toBe(20);
  });

  it('falha se bateria no clipe seguinte e não altera nada (atômica)', () => {
    const { p, a, b } = stills();
    const antes = JSON.stringify(p);
    expect(() => setClipsDuration(p, [b.id, a.id], 8)).toThrow(); // a [0,8] invade b [5,10]
    expect(JSON.stringify(p)).toBe(antes);
  });

  it('vídeo não passa da mídia de origem', () => {
    const { project, trackId } = fixtureProject(); // m1 tem 10 s
    const c = mediaClip('m1', 0, 4);
    const p = addClip(project, trackId, c);
    expect(findClip(setClipsDuration(p, [c.id], 10), c.id)!.clip.duration).toBe(10);
    expect(() => setClipsDuration(p, [c.id], 11)).toThrow();
  });

  it('recusa duração zero, negativa ou inválida', () => {
    const { p, a } = stills();
    for (const n of [0, -1, NaN, Infinity]) expect(() => setClipsDuration(p, [a.id], n), String(n)).toThrow();
  });
});
