export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  x: number;
  y: number;
  side: 'top' | 'bottom';
  /** Distância horizontal do centro do alvo até a borda esquerda do tooltip (para uma setinha). */
  arrowX: number;
}

/**
 * Calcula onde desenhar um tooltip de tamanho ${tip} junto ao alvo: centrado, preso às bordas da tela com margem,
 * do lado preferido (embaixo por padrão) e invertido se não couber. Se não couber em nenhum lado, vai para o que tem mais espaço.
 */
export function placeTooltip(target: Box, tip: { width: number; height: number }, viewport: { width: number; height: number }, opts: { gap?: number; margin?: number; prefer?: 'top' | 'bottom' } = {}): Placement {
  const gap = opts.gap ?? 8;
  const margin = opts.margin ?? 8;
  const prefer = opts.prefer ?? 'bottom';
  const center = target.left + target.width / 2;
  const x = Math.max(margin, Math.min(center - tip.width / 2, viewport.width - tip.width - margin));
  const below = target.top + target.height + gap;
  const above = target.top - gap - tip.height;
  const fitsBelow = below + tip.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  let side: 'top' | 'bottom';
  if (prefer === 'bottom') side = fitsBelow || !fitsAbove ? 'bottom' : 'top';
  else side = fitsAbove || !fitsBelow ? 'top' : 'bottom';
  if (!fitsBelow && !fitsAbove) side = viewport.height - (target.top + target.height) >= target.top ? 'bottom' : 'top';
  const y = side === 'bottom' ? Math.min(below, viewport.height - tip.height - margin) : Math.max(above, margin);
  return { x, y, side, arrowX: center - x };
}
