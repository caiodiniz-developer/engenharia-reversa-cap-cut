import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker } from './tracks';
import * as ops from './markersync';

function build(spans: Array<[number, number]>, markers: number[] = []) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  for (const t of markers) p = addMarker(p, t).project;
  return { p, trackId, ids };
}
const startOf = (p: Project, id: string) => findClip(p, id)!.clip.start;
const durOf = (p: Project, id: string) => findClip(p, id)!.clip.duration;

describe('snapClipsToMarkers', () => {
  it('leva cada clipe ao marcador mais próximo dentro da tolerância', () => {
    const { p, ids } = build([[0.3, 1], [4.2, 5]], [0, 4]);
    const r = ops.snapClipsToMarkers(p, ids, 0.5);
    expect(r.moved).toBe(2);
    expect(startOf(r.project, ids[0]!)).toBe(0);
    expect(startOf(r.project, ids[1]!)).toBe(4);
  });

  it('ignora quem está longe, quem já está no marcador, e conta os que colidiriam', () => {
    const { p, ids } = build([[0, 1], [2, 3], [3.4, 4.4]], [0, 3.5]);
    const r = ops.snapClipsToMarkers(p, ids, 0.5);
    expect(startOf(r.project, ids[0]!)).toBe(0); // já no marcador
    expect(startOf(r.project, ids[1]!)).toBe(2); // 1,5 s do marcador: fora da tolerância
    expect(startOf(r.project, ids[2]!)).toBe(3.5);
    expect(r.moved).toBe(1);
    const clash = build([[2, 3.2], [3.4, 4.4]], [3.5]);
    const c = ops.snapClipsToMarkers(clash.p, [clash.ids[0]!, clash.ids[1]!], 1.6);
    expect(c.skipped + c.moved).toBeGreaterThan(0);
  });

  it('recusa sem marcadores e tolerância inválida', () => {
    const { p, ids } = build([[0, 1]]);
    expect(() => ops.snapClipsToMarkers(p, ids)).toThrow(/marcadores/);
    expect(() => ops.snapClipsToMarkers(addMarker(p, 1).project, ids, 0)).toThrow();
  });
});

describe('stretchToNextMarker', () => {
  it('encurta ou estende o fim até o marcador seguinte ao início', () => {
    const { p, ids } = build([[0, 3], [5, 6]], [2, 7.5]);
    const r = ops.stretchToNextMarker(p, ids);
    expect(r.changed).toBe(2);
    expect(durOf(r.project, ids[0]!)).toBe(2); // 0 → marcador 2
    expect(durOf(r.project, ids[1]!)).toBe(2.5); // 5 → marcador 7,5 (a mídia tem 10 s)
  });

  it('clipe sem marcador depois do início não muda; mídia curta demais conta como ignorado', () => {
    const { p, ids } = build([[0, 1]], [0.5]);
    const none = ops.stretchToNextMarker(build([[3, 4]], [1]).p, [build([[3, 4]], [1]).ids[0]!]);
    expect(none.changed).toBe(0);
    const far = build([[0, 1]], [50]);
    const r = ops.stretchToNextMarker(far.p, far.ids);
    expect(r.skipped).toBe(1); // a mídia de 10 s não chega ao marcador de 50 s
    expect(durOf(r.project, far.ids[0]!)).toBe(1);
    expect(durOf(ops.stretchToNextMarker(p, ids).project, ids[0]!)).toBe(0.5);
  });

  it('exige marcadores', () => {
    const { p, ids } = build([[0, 1]]);
    expect(() => ops.stretchToNextMarker(p, ids)).toThrow(/marcadores/);
  });
});
