import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { repeatClip } from './repeat';
import { updateClip } from './clips';
import type { MediaClip } from '../schema';

describe('repeatClip', () => {
  it('cria N cópias encostadas depois do clipe, com ids novos e o mesmo conteúdo', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 1, 2, { sourceIn: 3 });
    const p0 = addClip(project, trackId, c);
    const { project: p, newIds } = repeatClip(p0, c.id, 3);
    expect(newIds).toHaveLength(3);
    expect(new Set([c.id, ...newIds]).size).toBe(4);
    expect(newIds.map((id) => findClip(p, id)!.clip.start)).toEqual([3, 5, 7]);
    for (const id of newIds) expect(findClip(p, id)!.clip).toMatchObject({ duration: 2, sourceIn: 3, mediaId: 'm1' });
  });

  it('copia efeitos com ids novos e descarta ligações e transição', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 2);
    let p = addClip(project, trackId, c);
    p = updateClip(p, c.id, (x) => ({ ...x, linkId: 'l1', groupId: 'g1', effects: [{ id: 'fx-a', type: 'blur', enabled: true, params: {} }] }) as MediaClip);
    const { project: out, newIds } = repeatClip(p, c.id, 1);
    const copy = findClip(out, newIds[0]!)!.clip as MediaClip;
    expect(copy.linkId).toBeUndefined();
    expect(copy.groupId).toBeUndefined();
    expect(copy.effects[0]!.id).not.toBe('fx-a');
    expect(copy.effects[0]!.type).toBe('blur');
  });

  it('falha quando as cópias bateriam em outro clipe da faixa', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 5, 2);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    expect(() => repeatClip(p, a.id, 3)).toThrow();
    expect(repeatClip(p, a.id, 1).newIds).toHaveLength(1); // 2..4 cabe antes do clipe em 5
  });

  it('valida a quantidade (1 a 50)', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 1);
    const p = addClip(project, trackId, c);
    for (const n of [0, -1, 1.5, 51]) expect(() => repeatClip(p, c.id, n), String(n)).toThrow();
  });
});
