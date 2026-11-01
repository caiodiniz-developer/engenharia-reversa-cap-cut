import { describe, expect, it } from 'vitest';
import type { Project, Track } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker, addTrack } from './tracks';
import * as ops from './markertools';

function build(...spans: Array<[number, number]>) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  return { p, ids, trackId };
}
