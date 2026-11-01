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

/** Define a opacidade (0 a 1) dos clipes escolhidos. */
export function setOpacity(p: Project, ids: string[], opacity: number): Project {
  if (!(opacity >= 0 && opacity <= 1)) throw new TimelineError('A opacidade vai de 0% a 100%', 'OUT_OF_RANGE');
  return mapTransform(p, ids, (t) => ({ ...t, opacity: round6(opacity) }));
}

/** Soma um deslocamento (fração da largura/altura do quadro) à posição dos clipes escolhidos. */
export function nudgeClips(p: Project, ids: string[], dx: number, dy: number): Project {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new TimelineError('Deslocamento inválido', 'INVALID');
  return mapTransform(p, ids, (t) => ({ ...t, x: round6(t.x + dx), y: round6(t.y + dy) }));
}

/** Multiplica a escala dos clipes escolhidos (limitada a 0,01–20). */
export function scaleClipsBy(p: Project, ids: string[], factor: number): Project {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new TimelineError('O fator de escala precisa ser positivo', 'OUT_OF_RANGE');
  return mapTransform(p, ids, (t) => ({ ...t, scale: round6(clamp(t.scale * factor, 0.01, 20)) }));
}

/** Soma graus à rotação dos clipes escolhidos; o resultado fica no intervalo (-180, 180]. */
export function rotateClipsBy(p: Project, ids: string[], degrees: number): Project {
  if (!Number.isFinite(degrees)) throw new TimelineError('Ângulo inválido', 'INVALID');
  return mapTransform(p, ids, (t) => {
    let r = (((t.rotation + degrees) % 360) + 360) % 360;
    if (r > 180) r -= 360;
    return { ...t, rotation: round6(r) };
  });
}

/** Alterna o espelhamento horizontal ('h') ou vertical ('v') dos clipes escolhidos. */
export function flipClips(p: Project, ids: string[], axis: 'h' | 'v'): Project {
  return mapTransform(p, ids, (t) => (axis === 'h' ? { ...t, flipH: !t.flipH } : { ...t, flipV: !t.flipV }));
}
