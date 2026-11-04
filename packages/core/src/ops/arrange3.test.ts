import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { Project } from '../schema';
import { CaptionClipSchema } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker, addTrack } from './tracks';
import * as ops from './arrange3';

function twoTracks() {
  const { project, trackId } = fixtureProject();
  const t2 = addTrack(project, 'video');
  return { p: t2.project, top: trackId, bottom: t2.track.id };
}
const trackOf = (p: Project, id: string) => p.tracks.find((t) => t.clips.some((c) => c.id === id))!.id;

describe('sendToAdjacentTrack', () => {
  it('vai para a faixa vizinha do mesmo tipo mantendo o instante', () => {
    const s = twoTracks();
    const c = mediaClip('m1', 3, 2);
    const p = addClip(s.p, s.bottom, c);
    const r = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(r.trackId).toBe(s.top);
    expect(trackOf(r.project, c.id)).toBe(s.top);
    expect(findClip(r.project, c.id)!.clip.start).toBe(3);
  });

  it('sem faixa do tipo naquela direção, cria uma nova e deixa a antiga vazia', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 2);
    const p = addClip(project, trackId, c);
    const up = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(up.project.tracks).toHaveLength(2);
    expect(up.project.tracks[0]!.id).toBe(up.trackId); // a nova ficou por cima
    expect(up.project.tracks.find((t) => t.id === trackId)!.clips).toHaveLength(0);
    const down = ops.sendToAdjacentTrack(p, [c.id], 1);
    expect(down.project.tracks[1]!.id).toBe(down.trackId);
  });

  it('falha se bater em clipe do destino, se estiverem em faixas diferentes ou se a faixa estiver bloqueada', () => {
    const s = twoTracks();
    const a = mediaClip('m1', 0, 3);
    const b = mediaClip('m2', 1, 3);
    let p = addClip(addClip(s.p, s.top, a), s.bottom, b);
    expect(() => ops.sendToAdjacentTrack(p, [b.id], -1)).toThrow();
    expect(() => ops.sendToAdjacentTrack(p, [a.id, b.id], -1)).toThrow(/mesma faixa/);
    p = { ...p, tracks: p.tracks.map((t) => (t.id === s.top ? { ...t, locked: true } : t)) };
    expect(() => ops.sendToAdjacentTrack(p, [b.id], -1)).toThrow();
  });

  it('um áudio só troca com faixas de áudio', () => {
    const { project } = fixtureProject();
    const a1 = addTrack(project, 'audio');
    const a2 = addTrack(a1.project, 'audio');
    const c = mediaClip('m1', 0, 1);
    const p = addClip(a2.project, a2.track.id, c);
    const r = ops.sendToAdjacentTrack(p, [c.id], -1);
    expect(r.project.tracks.find((t) => t.id === r.trackId)!.kind).toBe('audio');
  });
});

describe('removeEmptyTracks', () => {
  it('apaga só as faixas sem clipes e mantém a ordem das outras', () => {
    const s = twoTracks();
    const a = mediaClip('m1', 0, 2);
    const withClip = addClip(s.p, s.bottom, a);
    const extra = addTrack(withClip, 'audio');
    const r = ops.removeEmptyTracks(extra.project);
    expect(r.removed).toBe(2); // a faixa de cima e a de áudio
    expect(r.project.tracks.map((t) => t.id)).toEqual([s.bottom]);
  });

  it('sem faixas vazias devolve o mesmo projeto', () => {
    const s = twoTracks();
    const p = addClip(addClip(s.p, s.top, mediaClip('m1', 0, 1)), s.bottom, mediaClip('m2', 0, 1));
    const r = ops.removeEmptyTracks(p);
    expect(r.removed).toBe(0);
    expect(r.project).toBe(p);
  });
});

describe('matchDuration', () => {
  function three() {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 6, 4);
    const c = mediaClip('m1', 12, 3);
    const p = [a, b, c].reduce<Project>((acc, x) => addClip(acc, trackId, x), project);
    return { p, ids: [a.id, b.id, c.id] };
  }
  const durs = (p: Project, ids: string[]) => ids.map((id) => findClip(p, id)!.clip.duration);

  it('todos ficam com a duração do mais curto, do mais longo ou a média', () => {
    const s = three();
    expect(durs(ops.matchDuration(s.p, s.ids, 'shortest'), s.ids)).toEqual([2, 2, 2]);
    expect(durs(ops.matchDuration(s.p, s.ids, 'longest'), s.ids)).toEqual([4, 4, 4]);
    expect(durs(ops.matchDuration(s.p, s.ids, 'average'), s.ids)).toEqual([3, 3, 3]);
  });

  it('é atômico: se um clipe não pode crescer, nada muda', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 2, 4); // colado no seguinte
    const c = mediaClip('m1', 6, 1);
    const p = [a, b, c].reduce<Project>((acc, x) => addClip(acc, trackId, x), project);
    expect(() => ops.matchDuration(p, [a.id, b.id], 'longest')).toThrow(); // a bateria em b
    expect(durs(p, [a.id, b.id])).toEqual([2, 4]);
  });

  it('exige pelo menos dois clipes', () => {
    const s = three();
    expect(() => ops.matchDuration(s.p, [s.ids[0]!], 'shortest')).toThrow(/dois clipes/);
  });
});

describe('staggerClips', () => {
  it('em faixas diferentes: o mais cedo fica e os outros entram a cada intervalo', () => {
    const s = twoTracks();
    const a = mediaClip('m1', 1, 2);
    const b = mediaClip('m1', 1, 2);
    const c = mediaClip('m2', 1, 2);
    const t3 = addTrack(s.p, 'video');
    let p = addClip(addClip(t3.project, s.top, a), s.bottom, b);
    p = addClip(p, t3.track.id, c);
    const r = ops.staggerClips(p, [c.id, a.id, b.id], 0.5);
    expect([a.id, b.id, c.id].map((id) => findClip(r, id)!.clip.start)).toEqual([1, 1.5, 2]);
  });

  it('na mesma faixa pode colidir e então falha sem alterar nada', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 3, 2);
    const p = addClip(addClip(project, trackId, a), trackId, b);
    expect(() => ops.staggerClips(p, [a.id, b.id], 0.5)).toThrow(); // b iria para 0,5 e bateria em a
    expect(findClip(p, b.id)!.clip.start).toBe(3);
  });

  it('recusa intervalo fora de 0,05–5 s e menos de dois clipes', () => {
    const s = twoTracks();
    const a = mediaClip('m1', 0, 1);
    const b = mediaClip('m1', 0, 1);
    const p = addClip(addClip(s.p, s.top, a), s.bottom, b);
    expect(() => ops.staggerClips(p, [a.id, b.id], 0.01)).toThrow(/0,05/);
    expect(() => ops.staggerClips(p, [a.id], 1)).toThrow(/dois clipes/);
  });
});

describe('clipIdsInRange', () => {
  function scene() {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2); // 0–2
    const b = mediaClip('m1', 3, 2); // 3–5
    const c = mediaClip('m1', 4.5, 3); // 4,5–7,5
    const p = [a, b, c].reduce<Project>((acc, x) => addClip(acc, trackId, x.id === c.id ? { ...x, start: 6 } : x), project);
    return { p, trackId, a: a.id, b: b.id, c: c.id };
  }

  it('"dentro" pede o clipe inteiro; "tocando" aceita parte dele', () => {
    const s = scene(); // c ficou em 6–9
    expect(ops.clipIdsInRange(s.p, 2.5, 7)).toEqual([s.b]);
    expect(ops.clipIdsInRange(s.p, 2.5, 7, 'touching')).toEqual([s.b, s.c]);
    expect(ops.clipIdsInRange(s.p, 0, 20)).toEqual([s.a, s.b, s.c]);
  });

  it('bordas encostadas não contam como "tocando" e faixa bloqueada fica de fora', () => {
    const s = scene();
    expect(ops.clipIdsInRange(s.p, 2, 3, 'touching')).toEqual([]);
    const locked: Project = { ...s.p, tracks: s.p.tracks.map((t) => ({ ...t, locked: true })) };
    expect(ops.clipIdsInRange(locked, 0, 20)).toEqual([]);
    expect(() => ops.clipIdsInRange(s.p, 5, 5)).toThrow(/depois do início/);
  });
});

describe('markersAtCaptions', () => {
  function withCaptions(...texts: Array<[string, number]>) {
    const { project } = fixtureProject();
    const t = addTrack(project, 'caption');
    let p: Project = t.project;
    texts.forEach(([text, start], i) => {
      p = addClip(p, t.track.id, CaptionClipSchema.parse({ id: 'cap' + i, type: 'caption', text, start, duration: 1.5 }));
    });
    return p;
  }

  it('um marcador por legenda, com o texto como nome (cortado se longo)', () => {
    const p = withCaptions(['Olá, pessoal', 1], ['Uma legenda muito mais comprida que o limite do nome', 4]);
    const r = ops.markersAtCaptions(p);
    expect(r.added).toBe(2);
    expect(r.project.markers.map((m) => [m.time, m.label])).toEqual([[1, 'Olá, pessoal'], [4, 'Uma legenda muito mais comprida…']]);
    expect(r.project.markers[1]!.label.length).toBe(32);
  });

  it('não duplica onde já há marcador e ignora projeto sem legendas', () => {
    const p = addMarker(withCaptions(['Um', 1], ['Dois', 3]), 3).project;
    expect(ops.markersAtCaptions(p).added).toBe(1);
    const empty = fixtureProject().project;
    expect(ops.markersAtCaptions(empty)).toEqual({ project: empty, added: 0 });
  });
});
