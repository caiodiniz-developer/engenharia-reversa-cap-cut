import { describe, expect, it } from 'vitest';
import { findClip, projectDuration } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { extractAudio } from './advanced';
import * as ops from './editpro';

/** Projeto com um vídeo de 3 s (mídia m1, que tem áudio) a partir de 2 s da timeline, usando m1 desde 1,5 s, e o áudio extraído. */
function withAudio() {
  const { project, trackId } = fixtureProject();
  const v = mediaClip('m1', 2, 3, { sourceIn: 1.5 });
  const p = addClip(project, trackId, v);
  const r = extractAudio(p, v.id);
  return { p: r.project, video: v.id, audio: r.audioId, trackId };
}
const media = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;

describe('jCut', () => {
  it('o áudio passa a começar antes e a imagem fica como estava', () => {
    const s = withAudio();
    const out = ops.jCut(s.p, s.video, 1);
    expect(media(out, s.audio)).toMatchObject({ start: 1, duration: 4, sourceIn: 0.5 });
    expect(media(out, s.video)).toMatchObject({ start: 2, duration: 3, sourceIn: 1.5 });
    expect(media(out, s.audio).linkId).toBe(media(out, s.video).linkId); // continuam ligados
  });

  it('também vale escolhendo o próprio clipe de áudio', () => {
    const s = withAudio();
    expect(media(ops.jCut(s.p, s.audio, 0.5), s.audio).start).toBe(1.5);
  });

  it('recusa sem áudio extraído, sem mídia anterior suficiente e valor fora de 0,05–10', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 2, 3);
    const solo = addClip(project, trackId, c);
    expect(() => ops.jCut(solo, c.id, 1)).toThrow(/Extraia o áudio/);
    const s = withAudio();
    expect(() => ops.jCut(s.p, s.video, 2)).toThrow(); // só há 1,5 s de mídia antes do trecho
    expect(() => ops.jCut(s.p, s.video, 0.01)).toThrow(/0,05/);
  });
});
