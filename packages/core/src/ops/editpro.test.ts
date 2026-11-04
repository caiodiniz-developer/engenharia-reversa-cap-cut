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
