import { describe, expect, it } from 'vitest';
import { TimelineError } from '../errors';
import { findClip, projectDuration } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { deleteClips, duplicateClips, expandSelection, moveClip, moveClips, splitClip, trimClip, updateClip } from './clips';
import { setTrackProps } from './tracks';

describe('addClip', () => {
  it('insere e ordena por início', () => {
    const { project, trackId } = fixtureProject();
    let p = addClip(project, trackId, mediaClip('m1', 5, 2));
    p = addClip(p, trackId, mediaClip('m1', 0, 2));
    expect(p.tracks[0]!.clips.map((c) => c.start)).toEqual([0, 5]);
  });

  it('rejeita sobreposição', () => {
    const { project, trackId } = fixtureProject();
    const p = addClip(project, trackId, mediaClip('m1', 0, 5));
    expect(() => addClip(p, trackId, mediaClip('m1', 4, 3))).toThrowError(TimelineError);
  });

  it('rejeita clipe que ultrapassa a duração da mídia', () => {
    const { project, trackId } = fixtureProject();
    expect(() => addClip(project, trackId, mediaClip('m1', 0, 11))).toThrow(/duração da mídia/);
  });

  it('rejeita faixa bloqueada', () => {
    const { project, trackId } = fixtureProject();
    const locked = setTrackProps(project, trackId, { locked: true });
    expect(() => addClip(locked, trackId, mediaClip('m1', 0, 1))).toThrow(/bloqueada/);
  });
});

describe('splitClip', () => {
  it('divide e ajusta a origem das duas metades', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 2, 6, { sourceIn: 1 });
    const p = addClip(project, trackId, c);
    const r = splitClip(p, c.id, 5);
    const left = findClip(r.project, c.id)!.clip;
    const right = findClip(r.project, r.rightId)!.clip;
    expect(left).toMatchObject({ start: 2, duration: 3, sourceIn: 1 });
    expect(right).toMatchObject({ start: 5, duration: 3, sourceIn: 4 });
  });

  it('com velocidade 2x, a origem avança o dobro', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4, { speed: 2 });
    const r = splitClip(addClip(project, trackId, c), c.id, 1);
    const right = findClip(r.project, r.rightId)!.clip;
    expect(right).toMatchObject({ sourceIn: 2, duration: 3 });
  });

  it('clipe reverso: a metade da esquerda toca o final da origem', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 6, { reverse: true });
    const r = splitClip(addClip(project, trackId, c), c.id, 2);
    expect(findClip(r.project, c.id)!.clip).toMatchObject({ sourceIn: 4, duration: 2 });
    expect(findClip(r.project, r.rightId)!.clip).toMatchObject({ sourceIn: 0, duration: 4 });
  });

  it('recusa dividir fora do clipe', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 2, 2);
    const p = addClip(project, trackId, c);
    expect(() => splitClip(p, c.id, 2)).toThrow(TimelineError);
    expect(() => splitClip(p, c.id, 9)).toThrow(TimelineError);
  });

  it('mantém a duração total do projeto', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 8);
    const p = addClip(project, trackId, c);
    expect(projectDuration(splitClip(p, c.id, 3).project)).toBe(8);
  });

  it('divide clipes ligados e religa as metades direitas entre si', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 6, { linkId: 'L' });
    const b = mediaClip('m1', 0, 6, { linkId: 'L' });
    let p = addClip(project, trackId, a);
    p = { ...p, tracks: [...p.tracks, { id: 'a1', kind: 'audio', name: 'A', locked: false, hidden: false, muted: false, clips: [] }] };
    p = addClip(p, 'a1', b);
    const r = splitClip(p, a.id, 3);
    expect(r.rightId).toBeTruthy();
  });
});

describe('trimClip', () => {
  it('corte no início avança sourceIn e reduz a duração', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 1, 5);
    const p = trimClip(addClip(project, trackId, c), c.id, 'start', 2);
    expect(findClip(p, c.id)!.clip).toMatchObject({ start: 2, duration: 4, sourceIn: 1 });
  });

  it('estender o início além da mídia falha', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 3, 5, { sourceIn: 2 });
    const p = addClip(project, trackId, c);
    expect(findClip(trimClip(p, c.id, 'start', 2), c.id)!.clip).toMatchObject({ start: 2, sourceIn: 1, duration: 6 });
    expect(() => trimClip(p, c.id, 'start', 0)).toThrow(/mídia/);
  });

  it('corte no fim estende até o limite da mídia', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 5);
    const p = addClip(project, trackId, c);
    expect(findClip(trimClip(p, c.id, 'end', 10), c.id)!.clip.duration).toBe(10);
    expect(() => trimClip(p, c.id, 'end', 10.5)).toThrow(/mídia/);
  });

  it('não permite duração menor que 1 quadro', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 5);
    expect(() => trimClip(addClip(project, trackId, c), c.id, 'end', 0.001)).toThrow(TimelineError);
  });
});

describe('moveClip', () => {
  it('move e bloqueia sobreposição', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 3);
    const b = mediaClip('m1', 4, 3);
    let p = addClip(addClip(project, trackId, a), trackId, b);
    expect(findClip(moveClip(p, b.id, { start: 3 }), b.id)!.clip.start).toBe(3);
    expect(() => moveClip(p, b.id, { start: 2 })).toThrow(/Sobreposição/);
    p = moveClip(p, a.id, { start: 10 });
    expect(findClip(p, a.id)!.clip.start).toBe(10);
  });

  it('não permite início negativo (limita em zero)', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 2, 3);
    const p = moveClips(addClip(project, trackId, a), [a.id], -5);
    expect(findClip(p, a.id)!.clip.start).toBe(0);
  });
});

describe('deleteClips', () => {
  it('ripple fecha o espaço', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 2, 2);
    const c = mediaClip('m1', 4, 2);
    const p = [a, b, c].reduce((acc, clip) => addClip(acc, trackId, clip), project);
    const r = deleteClips(p, [b.id], { ripple: true });
    expect(findClip(r, c.id)!.clip.start).toBe(2);
    const s = deleteClips(p, [b.id]);
    expect(findClip(s, c.id)!.clip.start).toBe(4);
  });
});

describe('duplicateClips', () => {
  it('copia logo após o clipe', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const r = duplicateClips(addClip(project, trackId, a), [a.id]);
    expect(findClip(r.project, r.newIds[a.id]!)!.clip.start).toBe(2);
  });
});

describe('updateClip / expandSelection', () => {
  it('valida patch pelo schema', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const p = addClip(project, trackId, a);
    expect(() => updateClip(p, a.id, { duration: -1 })).toThrow();
    const q = updateClip(p, a.id, (c) => (c.type === 'media' ? { ...c, audio: { ...c.audio, volume: 2 } } : c));
    expect((findClip(q, a.id)!.clip as { audio: { volume: number } }).audio.volume).toBe(2);
  });

  it('expande seleção por linkId e groupId', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2, { groupId: 'G' });
    const b = mediaClip('m1', 3, 2, { groupId: 'G' });
    const c = mediaClip('m1', 6, 2);
    const p = [a, b, c].reduce((acc, clip) => addClip(acc, trackId, clip), project);
    expect(expandSelection(p, [a.id]).sort()).toEqual([a.id, b.id].sort());
  });
});
