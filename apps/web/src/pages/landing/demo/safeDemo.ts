import { getPlatform, isInsideSafe, safeRect } from '@editor/core';

export interface Verdict {
  inside: boolean;
  /** Distância (fração do quadro) até a zona segura mais próxima; 0 quando já está dentro. */
  overflow: number;
}

/** A legenda centralizada na horizontal, deslocada `y` do centro (fração do quadro, -0,5 a 0,5), cai na zona segura? */
export function captionVerdict(platformId: string, y: number): Verdict {
  const p = getPlatform(platformId);
  if (!p) return { inside: true, overflow: 0 };
  const inside = isInsideSafe(p, 0, y);
  const r = safeRect(p);
  const py = 0.5 + y;
  const overflow = inside ? 0 : Math.max(r.y - py, py - (r.y + r.h), 0);
  return { inside, overflow: Math.round(overflow * 1000) / 1000 };
}

/** Posição vertical mais baixa que ainda fica dentro da zona segura (com folga de 1,5% do quadro). */
export function suggestedCaptionY(platformId: string): number {
  const p = getPlatform(platformId);
  if (!p) return 0;
  const r = safeRect(p);
  return Math.round((r.y + r.h - 0.015 - 0.5) * 1000) / 1000;
}
