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

describe('duckUnder', () => {
  function scene() {
    const { project, trackId } = fixtureProject();
    const v = addTrack(project, 'audio');
    const music = mediaClip('m1', 0, 20);
    const voice1 = mediaClip('m1', 5, 3); // [5,8]
    const voice2 = mediaClip('m1', 8.4, 2); // [8.4,10.4], perto o bastante para fundir
    const voice3 = mediaClip('m1', 15, 1); // [15,16]
    let p = addClip(v.project, trackId, music);
    p = addClip(p, v.track.id, voice1);
    p = addClip(p, v.track.id, voice2);
    p = addClip(p, v.track.id, voice3);
    return { p, music, voices: [voice1.id, voice2.id, voice3.id] };
  }
  const vol = (p: Project, id: string, t: number) => {
    const c = findClip(p, id)!.clip as MediaClip;
    return evaluateKeyframes(c.keyframes.volume, t, c.audio.volume);
  };

  it('abaixa durante a voz e volta ao normal depois', () => {
    const { p, music, voices } = scene();
    const r = ops.duckUnder(p, [music.id], voices, { amount: 0.2, ramp: 0.5 });
    expect(r.ducked).toBe(1);
    expect(vol(r.project, music.id, 2)).toBe(1);
    expect(vol(r.project, music.id, 6)).toBeCloseTo(0.2, 6);
    expect(vol(r.project, music.id, 9)).toBeCloseTo(0.2, 6); // fundiu 5–8 com 8,4–10,4
    expect(vol(r.project, music.id, 12)).toBe(1);
    expect(vol(r.project, music.id, 15.5)).toBeCloseTo(0.2, 6);
    expect(vol(r.project, music.id, 19)).toBe(1);
  });

  it('desce em rampa, não de uma vez', () => {
    const { p, music, voices } = scene();
    const r = ops.duckUnder(p, [music.id], voices, { amount: 0, ramp: 1 });
    const mid = vol(r.project, music.id, 4.5); // meio da rampa 4–5
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('recusa parâmetros inválidos e ignora música que não cruza com a voz', () => {
    const { p, music, voices } = scene();
    expect(() => ops.duckUnder(p, [music.id], voices, { amount: 2 })).toThrow();
    expect(() => ops.duckUnder(p, [music.id], voices, { ramp: 0 })).toThrow();
    expect(() => ops.duckUnder(p, [music.id], [])).toThrow(/voz/);
    const far = ops.duckUnder(p, [music.id], [voices[2]!].slice(0, 0).concat([voices[2]!]), { amount: 0.5 });
    expect(far.ducked).toBe(1);
  });
});
