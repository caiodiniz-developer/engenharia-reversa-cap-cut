import { describe, expect, it } from 'vitest';
import { addMedia, createProject } from '../project';
import type { MediaAsset, MediaClip, Project } from '../schema';
import { addClip } from './clips';
import { montageOnMarkers } from './montage';
import { addMarker, addTrack } from './tracks';
import { mediaClip, videoAsset } from '../testing';

const image = (id: string): MediaAsset => ({ ...videoAsset(id, 5), kind: 'image', hasAudio: false, name: `${id}.png` });

function setup(times: number[], clips: Array<[string, number]> = [['a', 6], ['b', 6]]) {
  let p: Project = createProject('mont', { fps: 30 });
  p = addMedia(addMedia(addMedia(p, videoAsset('a', 6)), videoAsset('b', 6)), image('img'));
  const v = addTrack(p, 'video');
  p = v.project;
  let t = 0;
  for (const [id, d] of clips) {
    p = addClip(p, v.track.id, mediaClip(id, t, d));
    t += d;
  }
  for (const m of times) p = addMarker(p, m).project;
  return { p, vid: v.track.id };
}

const pieces = (p: Project, vid: string) => (p.tracks.find((t) => t.id === vid)!.clips as MediaClip[]).sort((x, y) => x.start - y.start);

describe('montageOnMarkers', () => {
  it('cada intervalo entre marcadores vira um plano, usando os clipes em rodízio', () => {
    const { p, vid } = setup([0, 1, 2.5, 3, 5]);
    const r = montageOnMarkers(p, vid);
    expect(r.shots).toBe(4);
    const c = pieces(r.project, vid);
    expect(c.map((x) => [x.start, x.duration, x.mediaId])).toEqual([[0, 1, 'a'], [1, 1.5, 'b'], [2.5, 0.5, 'a'], [3, 2, 'b']]);
  });

  it('cada clipe continua de onde o plano anterior dele parou', () => {
    const { p, vid } = setup([0, 1, 2, 3, 4]);
    const c = pieces(montageOnMarkers(p, vid).project, vid);
    // o clipe 'a' é usado nos planos 1 e 3: o segundo continua em 1 s da mídia, onde o primeiro parou
    expect(c.filter((x) => x.mediaId === 'a').map((x) => x.sourceIn)).toEqual([0, 1]);
    expect(c.filter((x) => x.mediaId === 'b').map((x) => x.sourceIn)).toEqual([0, 1]);
  });

  it('volta ao início da mídia quando ela acaba', () => {
    const { p, vid } = setup([0, 4, 8], [['a', 6]]);
    const c = pieces(montageOnMarkers(p, vid).project, vid);
    expect(c.map((x) => [x.start, x.duration, x.sourceIn])).toEqual([[0, 4, 0], [4, 4, 0]]); // 4 + 4 > 6 → recomeça
  });

  it('plano maior que a mídia fica do tamanho da mídia', () => {
    const { p, vid } = setup([0, 10], [['a', 6]]);
    const [only] = pieces(montageOnMarkers(p, vid).project, vid);
    expect(only).toMatchObject({ start: 0, duration: 6 });
  });

  it('imagens se repetem sem limite de origem', () => {
    let { p, vid } = setup([0, 8, 16], []);
    p = addClip(p, vid, mediaClip('img', 0, 5));
    const c = pieces(montageOnMarkers(p, vid).project, vid);
    expect(c.map((x) => [x.start, x.duration])).toEqual([[0, 8], [8, 8]]);
  });

  it('ids novos, sem ligação/grupo/transição, e a faixa original é substituída', () => {
    const { p, vid } = setup([0, 2, 4]);
    const before = new Set(pieces(p, vid).map((x) => x.id));
    const c = pieces(montageOnMarkers(p, vid).project, vid);
    for (const x of c) {
      expect(before.has(x.id)).toBe(false);
      expect(x.linkId).toBeUndefined();
      expect(x.transitionIn).toBeUndefined();
    }
  });

  it('recusa menos de dois marcadores, faixa sem mídia e faixa bloqueada', () => {
    const { p, vid } = setup([3]);
    expect(() => montageOnMarkers(p, vid)).toThrow(/dois pontos/);
    const empty = addTrack(setup([0, 2]).p, 'video');
    expect(() => montageOnMarkers(empty.project, empty.track.id)).toThrow(/clipes/);
    const locked = { ...setup([0, 2]).p };
    const lt = locked.tracks.map((t) => ({ ...t, locked: true }));
    expect(() => montageOnMarkers({ ...locked, tracks: lt }, lt[0]!.id)).toThrow();
  });
});
