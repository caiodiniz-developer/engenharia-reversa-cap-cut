import { describe, expect, it } from 'vitest';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { updateClip } from './clips';
import { duplicateTrack } from './trackdup';
import { setTrackProps } from './tracks';
import type { MediaClip } from '../schema';

function base() {
  const { project, trackId } = fixtureProject();
  const a = mediaClip('m1', 0, 2);
  const b = mediaClip('m1', 3, 2);
  let p = addClip(addClip(project, trackId, a), trackId, b);
  p = updateClip(p, a.id, (c) => ({ ...c, linkId: 'L1', groupId: 'G1', effects: [{ id: 'fx-1', type: 'blur', enabled: true, params: {} }] }) as MediaClip);
  p = updateClip(p, b.id, (c) => ({ ...c, linkId: 'L1', groupId: 'G1' }) as MediaClip);
  return { p, trackId, a, b };
}

describe('duplicateTrack', () => {
  it('insere a cópia logo abaixo da original, com nome próprio e clipes de ids novos', () => {
    const { p, trackId, a, b } = base();
    const { project, track } = duplicateTrack(p, trackId);
    expect(project.tracks).toHaveLength(2);
    expect(project.tracks[1]!.id).toBe(track.id);
    expect(track.name).toMatch(/\(cópia\)$/);
    expect(track.clips.map((c) => [c.start, c.duration])).toEqual([[0, 2], [3, 2]]);
    const ids = new Set([a.id, b.id, ...track.clips.map((c) => c.id)]);
    expect(ids.size).toBe(4);
  });

  it('ligações e grupos viram novos dentro da cópia (e continuam juntos nela)', () => {
    const { p, trackId } = base();
    const { track } = duplicateTrack(p, trackId);
    const [x, y] = track.clips;
    expect(x!.linkId).toBeTruthy();
    expect(x!.linkId).not.toBe('L1');
    expect(x!.linkId).toBe(y!.linkId);
    expect(x!.groupId).not.toBe('G1');
    expect(x!.groupId).toBe(y!.groupId);
  });

  it('efeitos da cópia têm ids novos; a original não é alterada', () => {
    const { p, trackId } = base();
    const { project, track } = duplicateTrack(p, trackId);
    expect((track.clips[0] as MediaClip).effects[0]!.id).not.toBe('fx-1');
    expect((project.tracks[0]!.clips.find((c) => c.start === 0) as MediaClip).effects[0]!.id).toBe('fx-1');
  });

  it('a cópia nasce desbloqueada mesmo se a original estava bloqueada', () => {
    const { p, trackId } = base();
    const locked = setTrackProps(p, trackId, { locked: true });
    expect(duplicateTrack(locked, trackId).track.locked).toBe(false);
  });

  it('falha para faixa inexistente', () => {
    const { p } = base();
    expect(() => duplicateTrack(p, 'nao-existe')).toThrow();
  });
});
