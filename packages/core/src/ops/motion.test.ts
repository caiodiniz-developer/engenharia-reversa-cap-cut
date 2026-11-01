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

describe('setOpacity', () => {
  it('vale para mídia e texto e recusa fora de 0–1', () => {
    const { p, id, trackId } = one();
    const text = TextClipSchema.parse({ id: 'tx1', type: 'text', text: 'oi', start: 5, duration: 1 });
    const p2 = addClip(p, trackId, text);
    const out = ops.setOpacity(p2, [id, 'tx1'], 0.4);
    expect(tr(out, id).opacity).toBe(0.4);
    expect(findClip(out, 'tx1')!.clip).toMatchObject({ transform: { opacity: 0.4 } });
    expect(() => ops.setOpacity(p2, [id], 1.5)).toThrow();
  });
});

describe('nudgeClips', () => {
  it('acumula deslocamentos', () => {
    const { p, id } = one();
    const out = ops.nudgeClips(ops.nudgeClips(p, [id], 0.1, -0.2), [id], 0.05, 0.1);
    expect(tr(out, id).x).toBeCloseTo(0.15, 6);
    expect(tr(out, id).y).toBeCloseTo(-0.1, 6);
    expect(() => ops.nudgeClips(p, [id], Number.NaN, 0)).toThrow();
  });
});
