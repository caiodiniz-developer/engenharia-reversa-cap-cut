import { describe, expect, it } from 'vitest';
import type { Project } from './schema';
import { selectionStats } from './stats';
import { addClip, fixtureProject, mediaClip } from './testing';
import { addTrack } from './ops/tracks';

function scene() {
  const { project, trackId } = fixtureProject();
  const a = mediaClip('m1', 1, 2); // 1–3
  const b = mediaClip('m1', 5, 1); // 5–6
  const t2 = addTrack(project, 'video');
  const c = mediaClip('m2', 0, 4); // 0–4, outra faixa
  let p: Project = addClip(addClip(t2.project, trackId, a), trackId, b);
  p = addClip(p, t2.track.id, c);
  return { p, a, b, c };
}

describe('selectionStats', () => {
  it('um clipe: intervalo e total iguais à duração dele', () => {
    const { p, a } = scene();
    expect(selectionStats(p, [a.id])).toEqual({ count: 1, from: 1, to: 3, span: 2, total: 2 });
  });

  it('vários clipes: o intervalo inclui os vãos e o total só soma as durações', () => {
    const { p, a, b } = scene();
    expect(selectionStats(p, [a.id, b.id])).toEqual({ count: 2, from: 1, to: 6, span: 5, total: 3 });
  });

  it('clipes em faixas diferentes entram juntos', () => {
    const { p, a, b, c } = scene();
    expect(selectionStats(p, [a.id, b.id, c.id])).toMatchObject({ count: 3, from: 0, to: 6, span: 6, total: 7 });
  });

  it('ids que não existem são ignorados e seleção vazia devolve null', () => {
    const { p, a } = scene();
    expect(selectionStats(p, [a.id, 'fantasma'])?.count).toBe(1);
    expect(selectionStats(p, ['fantasma'])).toBeNull();
    expect(selectionStats(p, [])).toBeNull();
  });
});
