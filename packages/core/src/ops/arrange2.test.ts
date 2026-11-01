import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { updateClip } from './clips';
import { addMarker, addTrack } from './tracks';
import * as ops from './arrange2';

/** Projeto com uma faixa de vídeo e clipes [início, fim] de m1 (10 s), na ordem dada. */
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
const startOf = (p: Project, id: string) => findClip(p, id)!.clip.start;
const endOf = (p: Project, id: string) => findClip(p, id)!.clip.start + findClip(p, id)!.clip.duration;
