import { describe, expect, it } from 'vitest';
import { TextClipSchema } from './schema';
import { addClip, fixtureProject, mediaClip } from './testing';
import { addMarker, addTrack } from './ops/tracks';
import { projectStats } from './stats';

describe('projectStats', () => {
  it('projeto vazio: tudo zerado, mas as mídias importadas aparecem como não usadas', () => {
    const { project } = fixtureProject();
    const s = projectStats(project);
    expect(s).toMatchObject({ duration: 0, tracks: 1, markers: 0, words: 0, longest: null, shortest: null, averageClip: 0 });
    expect(s.clips.total).toBe(0);
    expect(s.media).toMatchObject({ imported: 2, used: 0, unused: 2 });
  });

  it('conta clipes por tipo, palavras, extremos e média', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const b = mediaClip('m1', 2, 6);
    let p = addClip(addClip(project, trackId, a), trackId, b);
    const t = addTrack(p, 'text');
    p = addClip(t.project, t.track.id, TextClipSchema.parse({ id: 'tt', type: 'text', text: 'olá meu mundo', start: 0, duration: 1 }));
    p = addMarker(p, 1).project;
    const s = projectStats(p);
    expect(s.clips).toMatchObject({ video: 2, text: 1, total: 3 });
    expect(s.duration).toBe(8);
    expect(s.words).toBe(3);
    expect(s.longest).toEqual({ id: b.id, duration: 6 });
    expect(s.shortest).toEqual({ id: 'tt', duration: 1 });
    expect(s.averageClip).toBe(3);
    expect(s.media).toMatchObject({ imported: 2, used: 1, unused: 1, usedBytes: 1000 });
    expect(s.markers).toBe(1);
  });
});
