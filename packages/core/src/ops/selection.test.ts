import { describe, expect, it } from 'vitest';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './selection';

function scene() {
  const { project, trackId } = fixtureProject();
  const plain = mediaClip('m1', 0, 1);
  const muted = mediaClip('m1', 1, 1, { audio: { ...mediaClip('m1', 0, 1).audio, muted: true } });
  const fx = mediaClip('m1', 2, 3, { effects: [{ id: 'f1', type: 'brightness', enabled: true, params: { amount: 0.1 } }] });
  const kf = mediaClip('m1', 5, 0.5, { keyframes: { scale: [{ time: 0, value: 1, easing: 'linear' }] } });
  const fast = mediaClip('m1', 6, 2, { speed: 2 });
  const rev = mediaClip('m1', 8, 1, { reverse: true });
  let p: Project = project;
  for (const c of [plain, muted, fx, kf, fast, rev]) p = addClip(p, trackId, c as MediaClip);
  return { p, trackId, plain, muted, fx, kf, fast, rev };
}

describe('selectWhere', () => {
  it('cada critério encontra só os clipes certos', () => {
    const s = scene();
    expect(ops.selectWhere(s.p, 'muted')).toEqual([s.muted.id]);
    expect(ops.selectWhere(s.p, 'effects')).toEqual([s.fx.id]);
    expect(ops.selectWhere(s.p, 'keyframes')).toEqual([s.kf.id]);
    expect(ops.selectWhere(s.p, 'speed')).toEqual([s.fast.id]);
    expect(ops.selectWhere(s.p, 'reversed')).toEqual([s.rev.id]);
    expect(ops.selectWhere(s.p, 'transition')).toEqual([]);
    expect(ops.selectWhere(s.p, 'linked')).toEqual([]);
  });

  it('mais curtos e mais longos que uma duração (a borda não conta)', () => {
    const s = scene();
    expect(ops.selectWhere(s.p, 'shorter', 1)).toEqual([s.kf.id]); // 0,5 s; os de 1 s não são "mais curtos que 1"
    expect(ops.selectWhere(s.p, 'longer', 2).sort()).toEqual([s.fx.id]);
    expect(() => ops.selectWhere(s.p, 'shorter')).toThrow(/duração/);
  });

  it('a faixa silenciada marca os clipes dela e faixa bloqueada fica de fora', () => {
    const s = scene();
    const mutedTrack: Project = { ...s.p, tracks: s.p.tracks.map((t) => (t.id === s.trackId ? { ...t, muted: true } : t)) };
    expect(ops.selectWhere(mutedTrack, 'muted')).toHaveLength(6);
    const locked: Project = { ...s.p, tracks: s.p.tracks.map((t) => (t.id === s.trackId ? { ...t, locked: true } : t)) };
    expect(ops.selectWhere(locked, 'effects')).toEqual([]);
  });
});

describe('invertIds', () => {
  it('devolve todos os outros clipes', () => {
    const s = scene();
    const all = s.p.tracks[0]!.clips.map((c) => c.id);
    const inv = ops.invertIds(s.p, [s.plain.id, s.fx.id]);
    expect(inv).toHaveLength(4);
    expect(inv).not.toContain(s.plain.id);
    expect(ops.invertIds(s.p, [])).toHaveLength(all.length);
    expect(ops.invertIds(s.p, all)).toEqual([]);
  });

  it('não inclui clipes de faixa bloqueada', () => {
    const s = scene();
    const t2 = addTrack(s.p, 'video');
    const extra = mediaClip('m2', 0, 1);
    const p = addClip({ ...t2.project, tracks: t2.project.tracks.map((t) => (t.id === t2.track.id ? { ...t, locked: false } : t)) }, t2.track.id, extra);
    const locked: Project = { ...p, tracks: p.tracks.map((t) => (t.id === t2.track.id ? { ...t, locked: true } : t)) };
    expect(ops.invertIds(locked, [])).not.toContain(extra.id);
  });
});
