import { describe, expect, it } from 'vitest';
import { addMedia, createProject } from './project';
import { addClip } from './ops/clips';
import { addTrack, setTrackProps } from './ops/tracks';
import { mediaClip, videoAsset } from './testing';
import { pacingCurve, pacingLabel, pacingStats, stillStretches } from './pacing';
import type { Project } from './schema';

function withShots(lengths: number[]): { p: Project; vid: string } {
  let p: Project = addMedia(createProject('ritmo', { fps: 30 }), videoAsset('m1', 100));
  const v = addTrack(p, 'video');
  p = v.project;
  let t = 0;
  for (const l of lengths) {
    p = addClip(p, v.track.id, mediaClip('m1', t, l));
    t += l;
  }
  return { p, vid: v.track.id };
}

describe('pacingStats', () => {
  it('sem planos devolve null', () => {
    expect(pacingStats(createProject('vazio'))).toBeNull();
  });

  it('média, mediana, extremos, cortes por minuto e histograma', () => {
    const { p } = withShots([0.5, 1.5, 3, 5, 10]); // total 20 s, 5 planos
    const s = pacingStats(p)!;
    expect(s).toMatchObject({ shots: 5, average: 4, median: 3, shortest: 0.5, longest: 10, cutsPerMinute: 12 });
    expect(s.histogram).toEqual([1, 1, 1, 1, 1]);
  });

  it('mediana de quantidade par é a média dos dois do meio', () => {
    const { p } = withShots([1, 2, 4, 9]);
    expect(pacingStats(p)!.median).toBe(3);
  });

  it('ignora faixas ocultas e áudio', () => {
    const { p, vid } = withShots([2, 2]);
    expect(pacingStats(setTrackProps(p, vid, { hidden: true }))).toBeNull();
  });
});

describe('pacingLabel', () => {
  it('classifica pela duração média', () => {
    expect(pacingLabel(1)).toBe('Frenético');
    expect(pacingLabel(2)).toBe('Dinâmico');
    expect(pacingLabel(4)).toBe('Moderado');
    expect(pacingLabel(10)).toBe('Contemplativo');
  });
});

describe('pacingCurve / stillStretches', () => {
  it('conta cortes por janela (o primeiro plano, em 0 s, não é corte)', () => {
    const { p } = withShots([2, 2, 2, 10, 10]); // cortes em 2, 4, 6, 16
    expect(pacingCurve(p, 5)).toEqual([2, 1, 0, 1, 0, 0]);
  });

  it('acha trechos sem corte durante várias janelas seguidas', () => {
    const { p } = withShots([5, 40]); // um corte em 5 s e 40 s parados
    const stretches = stillStretches(p, 5, 3);
    expect(stretches).toEqual([{ start: 10, end: 45 }]);
    expect(stillStretches(p, 5, 20)).toEqual([]);
  });

  it('projeto vazio ou janela inválida devolve curva vazia', () => {
    expect(pacingCurve(createProject('x'), 5)).toEqual([]);
    expect(pacingCurve(withShots([3]).p, 0)).toEqual([]);
  });
});
