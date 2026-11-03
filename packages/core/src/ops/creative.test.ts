import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import * as ops from './creative';

/** Projeto com uma faixa de vídeo e clipes de m1 (10 s) nos intervalos dados. */
function build(...spans: Array<[number, number]>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, trackId, ids };
}
const media = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;
const sorted = (p: Project) => [...p.tracks[0]!.clips].sort((a, b) => a.start - b.start) as MediaClip[];
