import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { Project } from '../schema';
import { CaptionClipSchema } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker, addTrack } from './tracks';
import * as ops from './arrange3';

function twoTracks() {
  const { project, trackId } = fixtureProject();
  const t2 = addTrack(project, 'video');
  return { p: t2.project, top: trackId, bottom: t2.track.id };
}
const trackOf = (p: Project, id: string) => p.tracks.find((t) => t.clips.some((c) => c.id === id))!.id;

describe('sendToAdjacentTrack', () => {
  it('vai para a faixa vizinha do mesmo tipo mantendo o instante', () => {
    const s = twoTracks();
    const c = mediaClip('m1', 3, 2);
    const p = addClip(s.p, s.bottom, c);
    const r = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(r.trackId).toBe(s.top);
    expect(trackOf(r.project, c.id)).toBe(s.top);
    expect(findClip(r.project, c.id)!.clip.start).toBe(3);
  });

  it('sem faixa do tipo naquela direção, cria uma nova e deixa a antiga vazia', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 2);
    const p = addClip(project, trackId, c);
    const up = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(up.project.tracks).toHaveLength(2);
    expect(up.project.tracks[0]!.id).toBe(up.trackId); // a nova ficou por cima
    expect(up.project.tracks.find((t) => t.id === trackId)!.clips).toHaveLength(0);
    const down = ops.sendToAdjacentTrack(p, [c.id], 1);
    expect(down.project.tracks[1]!.id).toBe(down.trackId);
  });

  it('falha se bater em clipe do destino, se estiverem em faixas diferentes ou se a faixa estiver bloqueada', () => {
    const s = twoTracks();
    const a = mediaClip('m1', 0, 3);
    const b = mediaClip('m2', 1, 3);
    let p = addClip(addClip(s.p, s.top, a), s.bottom, b);
    expect(() => ops.sendToAdjacentTrack(p, [b.id], -1)).toThrow();
    expect(() => ops.sendToAdjacentTrack(p, [a.id, b.id], -1)).toThrow(/mesma faixa/);
    p = { ...p, tracks: p.tracks.map((t) => (t.id === s.top ? { ...t, locked: true } : t)) };
    expect(() => ops.sendToAdjacentTrack(p, [b.id], -1)).toThrow();
  });

  it('um áudio só troca com faixas de áudio', () => {
    const { project } = fixtureProject();
    const a1 = addTrack(project, 'audio');
    const a2 = addTrack(a1.project, 'audio');
    const c = mediaClip('m1', 0, 1);
    const p = addClip(a2.project, a2.track.id, c);
    const r = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(r.project.tracks.find((t) => t.id === r.trackId)!.kind).toBe('audio');
  });
});
