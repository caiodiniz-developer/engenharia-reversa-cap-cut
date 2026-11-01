import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { updateClip } from './clips';
import { addMarker, addTrack } from './tracks';
import * as ops from './arrange2';

/** Projeto com uma faixa de vídeo e clipes [início, fim] de m1 (10 s), na ordem dada. */
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
const startOf = (p: Project, id: string) => findClip(p, id)!.clip.start;
const endOf = (p: Project, id: string) => findClip(p, id)!.clip.start + findClip(p, id)!.clip.duration;

describe('reverseSequence', () => {
  it('o último vira o primeiro e os vãos ficam nos mesmos encaixes', () => {
    const { p, trackId, ids } = build([0, 2], [3, 6], [6.5, 7.5]); // vãos de 1 s e 0,5 s
    const out = ops.reverseSequence(p, trackId);
    expect(startOf(out, ids[2]!)).toBe(0);
    expect(startOf(out, ids[1]!)).toBe(2);
    expect(startOf(out, ids[0]!)).toBe(5.5);
  });

  it('inverter duas vezes volta ao original e uma faixa de um clipe não muda', () => {
    const { p, trackId, ids } = build([0, 2], [2, 5], [7, 8]);
    const twice = ops.reverseSequence(ops.reverseSequence(p, trackId), trackId);
    for (const id of ids) expect(startOf(twice, id)).toBe(startOf(p, id));
    const one = build([1, 2]);
    expect(ops.reverseSequence(one.p, one.trackId)).toEqual(one.p);
  });
});

describe('shuffleSequence', () => {
  it('shuffledOrder é uma permutação e depende da semente', () => {
    const a = ops.shuffledOrder([1, 2, 3, 4, 5, 6, 7, 8], 7);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ops.shuffledOrder([1, 2, 3, 4, 5, 6, 7, 8], 7)).toEqual(a);
    expect(ops.shuffledOrder([1, 2, 3, 4, 5, 6, 7, 8], 8)).not.toEqual(a);
  });

  it('a faixa continua com os mesmos clipes e o mesmo fim; a mesma semente repete a ordem', () => {
    const { p, trackId, ids } = build([0, 1], [1, 3], [3, 6], [6, 10]);
    const a = ops.shuffleSequence(p, trackId, 3);
    const b = ops.shuffleSequence(p, trackId, 3);
    expect(a).toEqual(b);
    expect(a.tracks[0]!.clips).toHaveLength(4);
    expect(Math.max(...ids.map((id) => endOf(a, id)))).toBe(10);
    const order = [...a.tracks[0]!.clips].sort((x, y) => x.start - y.start).map((c) => c.duration);
    expect([...order].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('alignClips', () => {
  function two() {
    const { project, trackId } = fixtureProject();
    const t2 = addTrack(project, 'video');
    const a = mediaClip('m1', 1, 2); // [1,3]
    const b = mediaClip('m1', 5, 4); // [5,9]
    let p = addClip(project === t2.project ? project : t2.project, trackId, a);
    p = addClip(p, t2.track.id, b);
    return { p, a, b };
  }

  it('início: todos começam onde o primeiro começa', () => {
    const { p, a, b } = two();
    const out = ops.alignClips(p, [a.id, b.id], 'start');
    expect(startOf(out, a.id)).toBe(1);
    expect(startOf(out, b.id)).toBe(1);
  });

  it('fim: todos terminam onde o último termina', () => {
    const { p, a, b } = two();
    const out = ops.alignClips(p, [a.id, b.id], 'end');
    expect(endOf(out, a.id)).toBe(9);
    expect(endOf(out, b.id)).toBe(9);
  });

  it('centro: o centro de cada clipe vai para o centro do conjunto', () => {
    const { p, a, b } = two();
    const out = ops.alignClips(p, [a.id, b.id], 'center'); // conjunto [1,9], centro 5
    expect(startOf(out, a.id) + 1).toBe(5);
    expect(startOf(out, b.id) + 2).toBe(5);
  });

  it('exige pelo menos dois clipes', () => {
    const { p, a } = two();
    expect(() => ops.alignClips(p, [a.id], 'start')).toThrow(/dois clipes/);
  });
});

describe('distributeClips', () => {
  it('vãos iguais entre os clipes e extremos fixos', () => {
    const { p, ids } = build([0, 1], [1.5, 2.5], [9, 10]); // sobram 7 s para 2 vãos
    const out = ops.distributeClips(p, ids);
    expect(startOf(out, ids[0]!)).toBe(0);
    expect(startOf(out, ids[1]!)).toBe(4.5);
    expect(startOf(out, ids[2]!)).toBe(9);
    expect(endOf(out, ids[1]!)).toBe(5.5);
  });

  it('precisa de três clipes e de espaço livre', () => {
    const { p, ids } = build([0, 1], [1, 2]);
    expect(() => ops.distributeClips(p, ids)).toThrow(/três|3/);
    const apertado = build([0, 3], [3, 6], [6, 9]);
    expect(ops.distributeClips(apertado.p, apertado.ids)).toEqual(apertado.p); // sem folga: nada se mexe
  });
});

describe('spaceClips', () => {
  it('aplica o vão entre clipes, a partir do primeiro', () => {
    const { p, ids } = build([0, 1], [5, 6], [9, 10]);
    const out = ops.spaceClips(p, ids, 0.5);
    expect([ids[0]!, ids[1]!, ids[2]!].map((id) => startOf(out, id))).toEqual([0, 1.5, 3]);
  });

  it('vão zero encosta os clipes e vão negativo é recusado', () => {
    const { p, ids } = build([1, 2], [6, 8]);
    const out = ops.spaceClips(p, ids, 0);
    expect(startOf(out, ids[1]!)).toBe(2);
    expect(() => ops.spaceClips(p, ids, -1)).toThrow();
  });
});

describe('splitEvery', () => {
  it('divide em pedaços de N segundos e o último leva o resto', () => {
    const { p, ids } = build([0, 10]);
    const r = ops.splitEvery(p, ids[0]!, 3);
    expect(r.ids).toHaveLength(4);
    expect(r.ids.map((id) => [startOf(r.project, id), findClip(r.project, id)!.clip.duration])).toEqual([[0, 3], [3, 3], [6, 3], [9, 1]]);
  });

  it('intervalo maior que o clipe não divide; intervalo inválido ou excessivo falha', () => {
    const { p, ids } = build([0, 4]);
    expect(ops.splitEvery(p, ids[0]!, 10).ids).toEqual([ids[0]]);
    expect(() => ops.splitEvery(p, ids[0]!, 0)).toThrow();
    expect(() => ops.splitEvery(p, ids[0]!, 0.01)).toThrow(/demais/);
  });
});

describe('splitIntoParts', () => {
  it('9 s em 3 partes dão três pedaços de 3 s consecutivos', () => {
    const { p, ids } = build([2, 11]);
    const r = ops.splitIntoParts(p, ids[0]!, 3);
    expect(r.ids.map((id) => [startOf(r.project, id), findClip(r.project, id)!.clip.duration])).toEqual([[2, 3], [5, 3], [8, 3]]);
  });

  it('rejeita menos de 2 e mais de 100 partes e partes menores que um quadro', () => {
    const { p, ids } = build([0, 2]);
    expect(() => ops.splitIntoParts(p, ids[0]!, 1)).toThrow();
    expect(() => ops.splitIntoParts(p, ids[0]!, 101)).toThrow();
    expect(() => ops.splitIntoParts(p, ids[0]!, 100)).toThrow(); // 0,02 s < 1 quadro a 30 fps
  });
});

describe('joinContiguous', () => {
  it('desfaz divisões: três pedaços contínuos viram um clipe só', () => {
    const { p, ids, trackId } = build([0, 6]);
    const a = ops.splitIntoParts(p, ids[0]!, 3).project;
    expect(a.tracks[0]!.clips).toHaveLength(3);
    const r = ops.joinContiguous(a, trackId);
    expect(r.merged).toBe(2);
    expect(r.project.tracks[0]!.clips).toHaveLength(1);
    expect(r.project.tracks[0]!.clips[0]).toMatchObject({ start: 0, duration: 6, sourceIn: 0 });
  });

  it('não une quando o volume é diferente, quando há vão ou quando a origem não é contínua', () => {
    const { p, ids, trackId } = build([0, 4]);
    const parts = ops.splitIntoParts(p, ids[0]!, 2);
    const louder = updateClip(parts.project, parts.ids[1]!, (c) => ({ ...c, audio: { ...(c as MediaClip).audio, volume: 0.5 } }) as MediaClip);
    expect(ops.joinContiguous(louder, trackId).merged).toBe(0);
    const gap = build([0, 2], [3, 5]);
    expect(ops.joinContiguous(gap.p, gap.trackId).merged).toBe(0);
    const jump = build([0, 2], [2, 4]); // mesma mídia, mas a origem recomeça do zero
    expect(ops.joinContiguous(jump.p, jump.trackId).merged).toBe(0);
  });
});

describe('snapToFrameGrid', () => {
  it('arredonda início e fim ao quadro (30 fps) e conta quantos mudaram', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0.01, 1.004); // fim 1,014 -> quadro 30 (1,0)
    const b = mediaClip('m1', 2, 1); // já na grade
    const p = addClip(addClip(project, trackId, a), trackId, b);
    const r = ops.snapToFrameGrid(p);
    expect(r.changed).toBe(1);
    expect(findClip(r.project, a.id)!.clip).toMatchObject({ start: 0, duration: 1 });
    expect(findClip(r.project, b.id)!.clip).toMatchObject({ start: 2, duration: 1 });
  });

  it('clipes contíguos continuam contíguos e a duração mínima é um quadro', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0.003, 1.001);
    const b = mediaClip('m1', 1.004, 0.004);
    const r = ops.snapToFrameGrid(addClip(addClip(project, trackId, a), trackId, b));
    const [x, y] = [findClip(r.project, a.id)!.clip, findClip(r.project, b.id)!.clip];
    expect(x.start + x.duration).toBeCloseTo(y.start, 6);
    expect(y.duration).toBeGreaterThanOrEqual(1 / 30 - 1e-6);
  });
});

describe('insertGap', () => {
  it('divide o clipe que atravessa o ponto e empurra o que vem depois', () => {
    const { p, ids } = build([0, 4], [6, 9]);
    const out = ops.insertGap(addMarker(p, 7).project, 2, 3);
    const clips = [...out.tracks[0]!.clips].sort((a, b) => a.start - b.start);
    expect(clips.map((c) => [c.start, c.duration])).toEqual([[0, 2], [5, 2], [9, 3]]);
    expect(out.markers[0]!.time).toBe(10);
    expect(startOf(out, ids[0]!)).toBe(0);
  });

  it('clipes antes do ponto não mudam e valores inválidos falham', () => {
    const { p, ids } = build([0, 1]);
    expect(startOf(ops.insertGap(p, 5, 2), ids[0]!)).toBe(0);
    expect(() => ops.insertGap(p, 1, 0)).toThrow();
    expect(() => ops.insertGap(p, -1, 1)).toThrow();
  });
});

describe('cutRange', () => {
  it('em várias faixas: divide as bordas, apaga o miolo e puxa o resto', () => {
    const { project, trackId } = fixtureProject();
    const t2 = addTrack(project, 'video');
    const big = mediaClip('m1', 0, 10);
    const inner = mediaClip('m1', 3, 1); // todo dentro do trecho 2–5
    const later = mediaClip('m1', 6, 2);
    let p = addClip(t2.project, trackId, big);
    p = addClip(p, t2.track.id, inner);
    p = addClip(p, t2.track.id, later);
    p = addMarker(addMarker(p, 3).project, 8).project;
    const out = ops.cutRange(p, 2, 5);
    const a = [...out.tracks.find((t) => t.id === trackId)!.clips].sort((x, y) => x.start - y.start);
    expect(a.map((c) => [c.start, c.duration])).toEqual([[0, 2], [2, 5]]);
    const b = out.tracks.find((t) => t.id === t2.track.id)!.clips;
    expect(b.map((c) => [c.start, c.duration])).toEqual([[3, 2]]);
    expect(out.markers.map((m) => m.time)).toEqual([5]); // o marcador de 3 s estava no trecho; o de 8 s voltou 3 s
  });

  it('recusa trecho vazio e faixa bloqueada com clipe no trecho', () => {
    const { p, trackId } = build([0, 6]);
    expect(() => ops.cutRange(p, 3, 3)).toThrow();
    const locked = { ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, locked: true } : t)) };
    expect(() => ops.cutRange(locked, 1, 2)).toThrow(/bloqueada/);
  });
});

describe('loopToFill', () => {
  it('3 s repetidos até 10 s: três cópias, a última encurtada para 1 s', () => {
    const { p, ids } = build([0, 3]);
    const r = ops.loopToFill(p, ids[0]!, 10);
    expect(r.newIds).toHaveLength(3);
    expect(endOf(r.project, r.newIds[2]!)).toBe(10);
    expect(findClip(r.project, r.newIds[2]!)!.clip.duration).toBe(1);
    expect(endOf(r.project, r.newIds[1]!)).toBe(9);
  });

  it('quando cabe um número exato de cópias não corta; instante antes do fim falha', () => {
    const { p, ids } = build([0, 2]);
    const r = ops.loopToFill(p, ids[0]!, 6);
    expect(r.newIds.map((id) => endOf(r.project, id))).toEqual([4, 6]);
    expect(() => ops.loopToFill(p, ids[0]!, 2)).toThrow();
  });
});
