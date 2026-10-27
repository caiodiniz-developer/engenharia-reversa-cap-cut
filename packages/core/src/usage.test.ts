import { describe, expect, it } from 'vitest';
import { usedMediaIds, unusedMediaIds } from './usage';
import { addClip, fixtureProject, mediaClip } from './testing';

describe('uso de mídias', () => {
  it('usedMediaIds lista só o que está na timeline', () => {
    const { project, trackId } = fixtureProject(); // m1 e m2 registradas; nenhum clipe
    expect([...usedMediaIds(project)]).toEqual([]);
    const p = addClip(addClip(project, trackId, mediaClip('m1', 0, 2)), trackId, mediaClip('m1', 3, 2));
    expect([...usedMediaIds(p)]).toEqual(['m1']);
  });

  it('unusedMediaIds devolve as da biblioteca sem clipe, na ordem da biblioteca', () => {
    const { project, trackId } = fixtureProject();
    const p = addClip(project, trackId, mediaClip('m2', 0, 2));
    expect(unusedMediaIds(p, ['m1', 'm2', 'm3'])).toEqual(['m1', 'm3']);
    expect(unusedMediaIds(p, [])).toEqual([]);
  });

  it('quando todas estão em uso não sobra nada', () => {
    const { project, trackId } = fixtureProject();
    const p = addClip(addClip(project, trackId, mediaClip('m1', 0, 1)), trackId, mediaClip('m2', 1, 1));
    expect(unusedMediaIds(p, ['m1', 'm2'])).toEqual([]);
  });
});
