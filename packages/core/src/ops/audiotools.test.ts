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

describe('setMuted', () => {
  it('silencia e reativa', () => {
    const { p, ids } = build([0, 1], [1, 2]);
    const mute = ops.setMuted(p, ids, true);
    expect(ids.every((id) => audioOf(mute, id).muted)).toBe(true);
    const back = ops.setMuted(mute, [ids[1]!], false);
    expect(audioOf(back, ids[0]!).muted).toBe(true);
    expect(audioOf(back, ids[1]!).muted).toBe(false);
  });
});

describe('setFades', () => {
  it('aplica entrada e saída', () => {
    const { p, ids } = build([0, 10]);
    const a = audioOf(ops.setFades(p, ids, 1, 2), ids[0]!);
    expect([a.fadeIn, a.fadeOut]).toEqual([1, 2]);
  });

  it('encolhe na mesma proporção quando a soma passa da duração', () => {
    const { p, ids } = build([0, 2]);
    const a = audioOf(ops.setFades(p, ids, 3, 1), ids[0]!); // soma 4 > 2
    expect(a.fadeIn).toBeCloseTo(1.5, 6);
    expect(a.fadeOut).toBeCloseTo(0.5, 6);
    expect(() => ops.setFades(p, ids, -1, 0)).toThrow();
  });
});

describe('setPan', () => {
  it('aceita de -1 a 1 e recusa o resto', () => {
    const { p, ids } = build([0, 1]);
    expect(audioOf(ops.setPan(p, ids, -1), ids[0]!).pan).toBe(-1);
    expect(audioOf(ops.setPan(p, ids, 0.25), ids[0]!).pan).toBe(0.25);
    expect(() => ops.setPan(p, ids, 1.1)).toThrow(/balanço/);
  });
});

describe('setEq', () => {
  it('muda só as bandas informadas', () => {
    const { p, ids } = build([0, 1]);
    const a = ops.setEq(p, ids, { bass: 6 });
    const b = ops.setEq(a, ids, { treble: -3 });
    expect(audioOf(b, ids[0]!).eq).toEqual({ bass: 6, mid: 0, treble: -3 });
  });

  it('recusa valores acima de 24 dB', () => {
    const { p, ids } = build([0, 1]);
    expect(() => ops.setEq(p, ids, { mid: 30 })).toThrow(/24 dB/);
  });
});

describe('setAudioFlags', () => {
  it('liga um sem alterar o outro', () => {
    const { p, ids } = build([0, 1]);
    const a = ops.setAudioFlags(p, ids, { normalize: true });
    expect(audioOf(a, ids[0]!)).toMatchObject({ normalize: true, denoise: false });
    const b = ops.setAudioFlags(a, ids, { denoise: true });
    expect(audioOf(b, ids[0]!)).toMatchObject({ normalize: true, denoise: true });
    expect(audioOf(ops.setAudioFlags(b, ids, { normalize: false }), ids[0]!)).toMatchObject({ normalize: false, denoise: true });
  });
});
