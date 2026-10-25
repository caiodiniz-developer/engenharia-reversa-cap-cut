import { describe, expect, it } from 'vitest';
import { addMarker } from './ops/tracks';
import { clipIdsAt, clipIdsBySide, editPoints, neighborEdit } from './navigation';
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
