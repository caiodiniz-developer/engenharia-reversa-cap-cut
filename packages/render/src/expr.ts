import type { Keyframe } from '@editor/core';
import { sortKeyframes } from '@editor/core';

const n = (v: number): string => Number(v.toFixed(6)).toString();

/**
 * Converte uma curva de keyframes em expressão do FFmpeg usando a variável de tempo local `lt`
 * (uma expressão como "(t-2.5)"). Reproduz evaluateKeyframes do core.
 */
export function keyframeExpr(kfs: Keyframe[] | undefined, fallback: number, lt: string): string {
  if (!kfs || kfs.length === 0) return n(fallback);
  const s = sortKeyframes(kfs);
  if (s.length === 1) return n(s[0]!.value);
  const seg = (i: number): string => {
    const a = s[i]!;
    const b = s[i + 1]!;
    const p = `((${lt}-${n(a.time)})/${n(b.time - a.time)})`;
    const eased = a.easing === 'hold' ? '0' : a.easing === 'ease' ? `(${p}*${p}*(3-2*${p}))` : p;
    const lerp = a.easing === 'hold' ? n(a.value) : `(${n(a.value)}+${n(b.value - a.value)}*${eased})`;
    if (i === s.length - 2) return `if(lt(${lt},${n(b.time)}),${lerp},${n(b.value)})`;
    return `if(lt(${lt},${n(b.time)}),${lerp},${seg(i + 1)})`;
  };
  return `if(lt(${lt},${n(s[0]!.time)}),${n(s[0]!.value)},${seg(0)})`;
}

export const isAnimated = (kfs: Keyframe[] | undefined): boolean => !!kfs && kfs.length > 1;

export { n as num };
