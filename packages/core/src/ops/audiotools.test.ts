import { describe, expect, it } from 'vitest';
import { evaluateKeyframes } from '../keyframes';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './audiotools';

function build(...spans: Array<[number, number]>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, trackId, ids };
}
const audioOf = (p: Project, id: string) => (findClip(p, id)!.clip as MediaClip).audio;

describe('setVolume', () => {
  it('aplica a todos os clipes escolhidos', () => {
    const { p, ids } = build([0, 1], [1, 2], [2, 3]);
    const out = ops.setVolume(p, [ids[0]!, ids[2]!], 0.5);
    expect(audioOf(out, ids[0]!).volume).toBe(0.5);
    expect(audioOf(out, ids[1]!).volume).toBe(1);
    expect(audioOf(out, ids[2]!).volume).toBe(0.5);
  });

  it('recusa valores fora de 0–4 e seleção sem mídia', () => {
    const { p, ids } = build([0, 1]);
    expect(() => ops.setVolume(p, ids, 5)).toThrow(/400%/);
    expect(() => ops.setVolume(p, ids, -0.1)).toThrow();
    expect(() => ops.setVolume(p, [], 1)).toThrow(/Selecione/);
  });
});

describe('adjustVolumeDb', () => {
  it('+6 dB aproximadamente dobra e -6 dB aproximadamente divide por dois', () => {
    const { p, ids } = build([0, 1]);
    expect(audioOf(ops.adjustVolumeDb(p, ids, 6), ids[0]!).volume).toBeCloseTo(1.995262, 5);
    expect(audioOf(ops.adjustVolumeDb(p, ids, -6), ids[0]!).volume).toBeCloseTo(0.501187, 5);
  });

  it('nunca passa de 400% nem fica negativo; 0 dB não muda', () => {
    const { p, ids } = build([0, 1]);
    expect(audioOf(ops.adjustVolumeDb(p, ids, 60), ids[0]!).volume).toBe(4);
    expect(audioOf(ops.adjustVolumeDb(p, ids, 0), ids[0]!).volume).toBe(1);
    expect(() => ops.adjustVolumeDb(p, ids, Number.NaN)).toThrow();
  });
});
