import { TimelineError } from '../errors';
import { upsertKeyframe } from '../keyframes';
import { findClip } from '../project';
import type { AnimatableProp, Clip, Keyframe, Project, Transform } from '../schema';
import { round6 } from '../time';
import { mulberry32 } from './arrange2';
import { updateClip } from './clips';
import { requireClip } from './helpers';

type WithTransform = Extract<Clip, { transform: Transform }>;
const hasTransform = (c: Clip): c is WithTransform => c.type === 'media' || c.type === 'text' || c.type === 'caption';

/** Aplica fn à transformação de cada clipe com imagem (mídia, texto, legenda) dentre os ids; falha se nenhum servir. */
export function mapTransform(p: Project, ids: string[], fn: (t: Transform, c: WithTransform) => Transform): Project {
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    if (!hasTransform(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => ({ ...(c as WithTransform), transform: fn((c as WithTransform).transform, c as WithTransform) }) as Clip);
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou texto', 'KIND_MISMATCH');
  return next;
}

/** Troca as curvas de keyframes das propriedades dadas no clipe (as demais ficam como estão). */
export function withKeyframes(p: Project, id: string, curves: Partial<Record<AnimatableProp, Keyframe[]>>): Project {
  return updateClip(p, id, (c) => ({ ...c, keyframes: { ...c.keyframes, ...curves } }) as Clip);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
