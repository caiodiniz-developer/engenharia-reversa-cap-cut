/** Predefinições de posição (grade 3×3) e de preenchimento para clipes visuais. */

export type PositionPreset = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

export const POSITION_PRESETS: PositionPreset[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

export const POSITION_LABEL: Record<PositionPreset, string> = {
  'top-left': 'Canto superior esquerdo',
  top: 'Topo',
  'top-right': 'Canto superior direito',
  left: 'Esquerda',
  center: 'Centro',
  right: 'Direita',
  'bottom-left': 'Canto inferior esquerdo',
  bottom: 'Base',
  'bottom-right': 'Canto inferior direito',
};

export interface Size {
  width: number;
  height: number;
}

/**
 * Fração do quadro ocupada pelo clipe: a mídia é ajustada ao quadro ("contain") e depois multiplicada pela escala.
 * Valores acima de 1 significam que o clipe passa das bordas do quadro.
 */
export function shownFraction(asset: Size, frame: Size, scale: number): { w: number; h: number } {
  const fit = Math.min(frame.width / asset.width, frame.height / asset.height);
  return { w: (asset.width * fit * scale) / frame.width, h: (asset.height * fit * scale) / frame.height };
}

/**
 * Deslocamento (x, y como fração do quadro, 0 = centro) que encosta o clipe na borda/canto escolhido.
 * Se o clipe é maior que o quadro naquele eixo, ele fica centralizado nesse eixo.
 */
export function positionFor(preset: PositionPreset, asset: Size, frame: Size, scale: number): { x: number; y: number } {
  const { w, h } = shownFraction(asset, frame, scale);
  const room = (shown: number) => Math.max(0, 0.5 - shown / 2);
  const col = preset.includes('left') ? -1 : preset.includes('right') ? 1 : 0;
  const row = preset.startsWith('top') ? -1 : preset.startsWith('bottom') ? 1 : 0;
  const round = (n: number) => Math.round(n * 1e6) / 1e6 || 0;
  return { x: round(col * room(w)), y: round(row * room(h)) };
}

/**
 * Escala que faz a mídia cobrir o quadro inteiro ("cover"), sem barras, cortando o excesso.
 * Como a escala do clipe é relativa ao ajuste "contain", é a razão entre os dois ajustes.
 */
export function coverScale(asset: Size, frame: Size): number {
  const rw = frame.width / asset.width;
  const rh = frame.height / asset.height;
  return Math.round((Math.max(rw, rh) / Math.min(rw, rh)) * 1e6) / 1e6;
}
