import { describe, expect, it } from 'vitest';
import { addMarker } from './ops/tracks';
import { clampWorkArea, clipIdsAt, clipIdsBySide, editPoints, neighborEdit, setWorkAreaEdge } from './navigation';
import { addClip, fixtureProject, mediaClip } from './testing';

function build() {
  const { project, trackId } = fixtureProject();
  let p = addClip(project, trackId, mediaClip('m1', 1, 2));
  p = addClip(p, trackId, mediaClip('m1', 5, 3));
  return p;
}

describe('navegação entre cortes', () => {
  it('lista início e fim dos clipes (e o zero), ordenados e sem repetir', () => {
    expect(editPoints(build())).toEqual([0, 1, 3, 5, 8]);
  });

  it('próximo e anterior ignoram o ponto em que já estamos', () => {
    const p = build();
    expect(neighborEdit(p, 0, 1)).toBe(1);
    expect(neighborEdit(p, 1, 1)).toBe(3);
    expect(neighborEdit(p, 3, -1)).toBe(1);
    expect(neighborEdit(p, 4, -1)).toBe(3);
    expect(neighborEdit(p, 8, 1)).toBeUndefined();
    expect(neighborEdit(p, 0, -1)).toBeUndefined();
  });

  it('marcadores só entram quando pedido', () => {
    const p = addMarker(build(), 4, 'x').project;
    expect(editPoints(p)).toEqual([0, 1, 3, 5, 8]);
    expect(editPoints(p, { markers: true })).toEqual([0, 1, 3, 4, 5, 8]);
  });
});

describe('seleção por lado da cabeça de reprodução', () => {
  it('à direita pega os clipes que começam a partir do instante; à esquerda, os que terminam até ele', () => {
    const p = build(); // clipes em [1,3] e [5,8]
    const [a, b] = p.tracks[0]!.clips.map((c) => c.id);
    expect(clipIdsBySide(p, 3, 'after')).toEqual([b]);
    expect(clipIdsBySide(p, 1, 'after')).toEqual([a, b]);
    expect(clipIdsBySide(p, 4, 'before')).toEqual([a]);
    expect(clipIdsBySide(p, 8, 'before')).toEqual([a, b]);
  });

  it('um clipe que atravessa o instante não entra em nenhum dos lados', () => {
    const p = build();
    expect(clipIdsBySide(p, 2, 'after').length).toBe(1);
    expect(clipIdsBySide(p, 2, 'before')).toEqual([]);
  });

  it('clipIdsAt devolve só os clipes sob o instante (bordas não contam)', () => {
    const p = build();
    const [a] = p.tracks[0]!.clips.map((c) => c.id);
    expect(clipIdsAt(p, 2)).toEqual([a]);
    expect(clipIdsAt(p, 3)).toEqual([]);
    expect(clipIdsAt(p, 4)).toEqual([]);
  });
});

describe('área de trabalho (entrada e saída)', () => {
  it('sem área prévia, entrada vai até o fim do projeto e saída parte do começo', () => {
    expect(setWorkAreaEdge(null, 'start', 2, 10)).toEqual({ start: 2, end: 10 });
    expect(setWorkAreaEdge(null, 'end', 4, 10)).toEqual({ start: 0, end: 4 });
  });

  it('ajusta cada borda separadamente', () => {
    const a = setWorkAreaEdge(null, 'start', 2, 10);
    expect(setWorkAreaEdge(a, 'end', 6, 10)).toEqual({ start: 2, end: 6 });
    expect(setWorkAreaEdge({ start: 2, end: 6 }, 'start', 3, 10)).toEqual({ start: 3, end: 6 });
  });

  it('a borda que ultrapassa a outra devolve a outra ao limite do projeto', () => {
    expect(setWorkAreaEdge({ start: 2, end: 6 }, 'start', 8, 10)).toEqual({ start: 8, end: 10 });
    expect(setWorkAreaEdge({ start: 2, end: 6 }, 'end', 1, 10)).toEqual({ start: 0, end: 1 });
  });

  it('limita ao projeto e recusa área vazia', () => {
    expect(setWorkAreaEdge(null, 'end', 99, 10)).toEqual({ start: 0, end: 10 });
    expect(setWorkAreaEdge(null, 'start', 10, 10)).toBeNull();
    expect(setWorkAreaEdge(null, 'start', 1, 0)).toBeNull();
  });

  it('clampWorkArea encolhe com o projeto e some se não sobra trecho', () => {
    expect(clampWorkArea({ start: 2, end: 9 }, 6)).toEqual({ start: 2, end: 6 });
    expect(clampWorkArea({ start: 5, end: 9 }, 5.05)).toBeNull();
    expect(clampWorkArea(null, 5)).toBeNull();
  });
});
