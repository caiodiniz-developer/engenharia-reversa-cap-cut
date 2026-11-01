import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './mediatools';

function stacked() {
  const { project, trackId } = fixtureProject();
  const t2 = addTrack(project, 'video');
  const t3 = addTrack(t2.project, 'video');
  const a = mediaClip('m1', 1, 2);
  const b = mediaClip('m1', 1, 2); // idêntico a a, em outra faixa
  const c = mediaClip('m1', 1, 2, { sourceIn: 3 }); // outro trecho da origem
  const d = mediaClip('m2', 1, 2); // outra mídia
  let p: Project = addClip(t3.project, trackId, a);
  p = addClip(p, t2.track.id, b);
  p = addClip(p, t3.track.id, c);
  p = addClip(p, trackId, { ...d, start: 5 });
  return { p, a, b, c, d };
}

describe('clipes duplicados', () => {
  it('agrupa só os realmente idênticos', () => {
    const { p, a, b } = stacked();
    expect(ops.findDuplicateClips(p).map((g) => [...g].sort())).toEqual([[a.id, b.id].sort()]);
  });

  it('remove as cópias e mantém um por grupo; sem duplicados não muda nada', () => {
    const { p, a, b } = stacked();
    const r = ops.removeDuplicateClips(p);
    expect(r.removed).toBe(1);
    const left = [findClip(r.project, a.id), findClip(r.project, b.id)].filter(Boolean);
    expect(left).toHaveLength(1);
    expect(ops.removeDuplicateClips(r.project)).toEqual({ project: r.project, removed: 0 });
  });
});

describe('replaceMedia', () => {
  it('troca em todos os clipes e preserva os ajustes', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2, { speed: 2 });
    const b = mediaClip('m1', 5, 1);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    const r = ops.replaceMedia(p, 'm1', 'm2');
    expect(r.replaced).toBe(2);
    expect((findClip(r.project, a.id)!.clip as MediaClip)).toMatchObject({ mediaId: 'm2', speed: 2, start: 0, duration: 2 });
  });

  it('recusa: igual, inexistente, tipo diferente, sem uso e nova mídia curta demais', () => {
    const { project, trackId } = fixtureProject();
    const p = addClip(project, trackId, mediaClip('m1', 0, 8));
    expect(() => ops.replaceMedia(p, 'm1', 'm1')).toThrow();
    expect(() => ops.replaceMedia(p, 'm1', 'nada')).toThrow(/não encontrada/);
    expect(() => ops.replaceMedia(p, 'm2', 'm1')).toThrow(/não está sendo usada/);
    const img = { ...p, media: { ...p.media, img: { ...p.media.m2!, id: 'img', kind: 'image' as const } } };
    expect(() => ops.replaceMedia(img, 'm1', 'img')).toThrow(/mesmo tipo/);
    const curta = { ...p, media: { ...p.media, m2: { ...p.media.m2!, duration: 3 } } };
    expect(() => ops.replaceMedia(curta, 'm1', 'm2')).toThrow(/duração/);
  });
});
