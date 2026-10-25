import { createCanvas } from '@napi-rs/canvas';

export interface BackgroundSpec {
  kind: 'solid' | 'gradient';
  color: string;
  /** Segunda cor do degradê. */
  color2?: string;
  /** Ângulo do degradê em graus (0 = de baixo para cima, 90 = da esquerda para a direita). */
  angle?: number;
  width: number;
  height: number;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const MAX_GENERATED_SIDE = 3840;

/** Gera um PNG de fundo (cor sólida ou degradê linear). Validações de entrada protegem o servidor. */
export function renderBackgroundPng(spec: BackgroundSpec): Buffer {
  if (!HEX.test(spec.color) || (spec.kind === 'gradient' && !HEX.test(spec.color2 ?? ''))) throw new Error('Cor inválida (use #rrggbb)');
  const { width, height } = spec;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > MAX_GENERATED_SIDE || height > MAX_GENERATED_SIDE) {
    throw new Error(`Dimensões inválidas (16 a ${MAX_GENERATED_SIDE} px)`);
  }
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (spec.kind === 'solid') {
    ctx.fillStyle = spec.color;
  } else {
    // Linha do degradê que cruza o centro na direção do ângulo e cobre o quadro inteiro.
    const rad = ((spec.angle ?? 180) - 90) * (Math.PI / 180);
    const cx = width / 2;
    const cy = height / 2;
    const half = (Math.abs(Math.cos(rad)) * width + Math.abs(Math.sin(rad)) * height) / 2;
    const g = ctx.createLinearGradient(cx - Math.cos(rad) * half, cy - Math.sin(rad) * half, cx + Math.cos(rad) * half, cy + Math.sin(rad) * half);
    g.addColorStop(0, spec.color);
    g.addColorStop(1, spec.color2!);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
}
