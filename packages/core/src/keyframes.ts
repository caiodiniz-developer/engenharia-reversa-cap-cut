import type { AnimatableProp, Clip, Easing, Keyframe, Transform } from './schema';
import { round6 } from './time';

export function applyEasing(p: number, easing: Easing): number {
  const c = Math.min(1, Math.max(0, p));
  switch (easing) {
    case 'linear':
      return c;
    case 'ease':
      return c * c * (3 - 2 * c);
    case 'hold':
      return 0;
  }
}

/** Avalia a curva de keyframes no tempo local (s desde o início do clipe). Sem keyframes devolve fallback. */
export function evaluateKeyframes(kfs: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  const sorted = sortKeyframes(kfs);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (t <= first.time) return first.value;
  if (t >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (t >= a.time && t < b.time) {
      const p = (t - a.time) / (b.time - a.time);
      if (a.easing === 'hold') return a.value;
      return a.value + (b.value - a.value) * applyEasing(p, a.easing);
    }
  }
  return last.value;
}

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.time - b.time);
}

/** Insere ou substitui (mesmo tempo) um keyframe. */
export function upsertKeyframe(
  kfs: Keyframe[] | undefined,
  time: number,
  value: number,
  easing: Easing = 'linear',
): Keyframe[] {
  const t = round6(time);
  const rest = (kfs ?? []).filter((k) => Math.abs(k.time - t) > 1e-4);
  return sortKeyframes([...rest, { time: t, value, easing }]);
}

export function removeKeyframeAt(kfs: Keyframe[] | undefined, time: number): Keyframe[] {
  return (kfs ?? []).filter((k) => Math.abs(k.time - time) > 1e-4);
}

/** Transformação efetiva do clipe em um tempo local, aplicando keyframes sobre os valores estáticos. */
export function resolveTransform(clip: Clip, localTime: number): Transform {
  if (clip.type === 'text' || clip.type === 'caption' || clip.type === 'media') {
    const base = clip.transform;
    const k = clip.keyframes;
    return {
      ...base,
      x: evaluateKeyframes(k.x, localTime, base.x),
      y: evaluateKeyframes(k.y, localTime, base.y),
      scale: evaluateKeyframes(k.scale, localTime, base.scale),
      rotation: evaluateKeyframes(k.rotation, localTime, base.rotation),
      opacity: Math.min(1, Math.max(0, evaluateKeyframes(k.opacity, localTime, base.opacity))),
    };
  }
  throw new Error('unreachable');
}

export function hasKeyframes(clip: Clip, prop: AnimatableProp): boolean {
  return (clip.keyframes[prop]?.length ?? 0) > 0;
}

/** Divide uma curva em um instante: devolve as partes esquerda e direita (direita reiniciada em 0). */
export function splitKeyframes(
  kfs: Keyframe[] | undefined,
  at: number,
  fallback: number,
): { left: Keyframe[] | undefined; right: Keyframe[] | undefined } {
  if (!kfs || kfs.length === 0) return { left: kfs, right: kfs };
  const valueAt = evaluateKeyframes(kfs, at, fallback);
  const sorted = sortKeyframes(kfs);
  const left = sorted.filter((k) => k.time < at);
  left.push({ time: round6(at), value: valueAt, easing: 'linear' });
  const right: Keyframe[] = [{ time: 0, value: valueAt, easing: 'linear' }];
  for (const k of sorted) if (k.time > at) right.push({ ...k, time: round6(k.time - at) });
  return { left, right };
}
