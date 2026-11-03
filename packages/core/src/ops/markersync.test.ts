import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { Project } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker } from './tracks';
import * as ops from './markersync';

function build(spans: Array<[number, number]>, markers: number[] = []) {
  const { project, trackId } = fixtureProject();
  let p: Project = project;
  const ids: string[] = [];
  for (const [a, b] of spans) {
    const c = mediaClip('m1', a, b - a);
    p = addClip(p, trackId, c);
    ids.push(c.id);
  }
  for (const t of markers) p = addMarker(p, t).project;
  return { p, trackId, ids };
}
const startOf = (p: Project, id: string) => findClip(p, id)!.clip.start;
const durOf = (p: Project, id: string) => findClip(p, id)!.clip.duration;
