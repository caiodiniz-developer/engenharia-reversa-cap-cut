import { describe, expect, it } from 'vitest';
import { evaluateKeyframes } from '../keyframes';
import { findClip } from '../project';
import type { MediaClip, Project } from '../schema';
import { TextClipSchema } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import * as ops from './motion';

function one(duration = 4, start = 0) {
  const { project, trackId } = fixtureProject();
  const c = mediaClip('m1', start, duration);
  return { p: addClip(project, trackId, c), id: c.id, trackId };
}
const clipOf = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;
const tr = (p: Project, id: string) => clipOf(p, id).transform;
