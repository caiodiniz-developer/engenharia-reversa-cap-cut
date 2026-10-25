import { describe, expect, it } from 'vitest';
import { addMarker } from './ops/tracks';
import { editPoints, neighborEdit } from './navigation';
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
