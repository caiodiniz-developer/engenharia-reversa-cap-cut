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

export const SHAPES = ['circle', 'square', 'rounded', 'triangle', 'star', 'heart', 'arrow', 'line'] as const;
export type ShapeKind = (typeof SHAPES)[number];

export interface ShapeSpec {
  shape: ShapeKind;
  color: string;
  /** Lado do PNG quadrado (padrão 1080). */
  size?: number;
}

/** Desenha o caminho da forma dentro de um quadrado de lado `s` (margem de 8%). */
function shapePath(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, shape: ShapeKind, s: number): void {
  const m = s * 0.08;
  const a = m;
  const b = s - m;
  const c = s / 2;
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(c, c, (b - a) / 2, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rect(a, a, b - a, b - a);
      break;
    case 'rounded': {
      const r = (b - a) * 0.22;
      ctx.moveTo(a + r, a);
      ctx.arcTo(b, a, b, b, r);
      ctx.arcTo(b, b, a, b, r);
      ctx.arcTo(a, b, a, a, r);
      ctx.arcTo(a, a, b, a, r);
      break;
    }
    case 'triangle':
      ctx.moveTo(c, a);
      ctx.lineTo(b, b);
      ctx.lineTo(a, b);
      break;
    case 'star': {
      const R = (b - a) / 2;
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? R : R * 0.42;
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = c + Math.cos(ang) * rad;
        const y = c + 0.04 * s + Math.sin(ang) * rad;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      break;
    }
    case 'heart': {
      const w = b - a;
      const top = a + w * 0.2;
      ctx.moveTo(c, b);
      ctx.bezierCurveTo(a - w * 0.05, a + w * 0.62, a + w * 0.02, top - w * 0.12, a + w * 0.28, top - w * 0.02);
      ctx.bezierCurveTo(a + w * 0.4, top - w * 0.06, c - w * 0.02, top + w * 0.02, c, top + w * 0.14);
      ctx.bezierCurveTo(c + w * 0.02, top + w * 0.02, b - w * 0.4 + w * 0.06, top - w * 0.06, b - w * 0.28, top - w * 0.02);
      ctx.bezierCurveTo(b - w * 0.02, top - w * 0.12, b + w * 0.05, a + w * 0.62, c, b);
      break;
    }
    case 'arrow': {
      const h = (b - a) * 0.22; // meia espessura da haste
      const head = (b - a) * 0.38;
      ctx.moveTo(a, c - h);
      ctx.lineTo(b - head, c - h);
      ctx.lineTo(b - head, a + (b - a) * 0.12);
      ctx.lineTo(b, c);
      ctx.lineTo(b - head, b - (b - a) * 0.12);
      ctx.lineTo(b - head, c + h);
      ctx.lineTo(a, c + h);
      break;
    }
    case 'line': {
      const h = s * 0.025;
      ctx.rect(a, c - h, b - a, h * 2);
      break;
    }
  }
  ctx.closePath();
}

/** Gera um PNG quadrado com fundo transparente contendo a forma preenchida. */
export function renderShapePng(spec: ShapeSpec): Buffer {
  if (!HEX.test(spec.color)) throw new Error('Cor inválida (use #rrggbb)');
  if (!SHAPES.includes(spec.shape)) throw new Error('Forma desconhecida');
  const size = spec.size ?? 1080;
  if (!Number.isInteger(size) || size < 16 || size > MAX_GENERATED_SIDE) throw new Error(`Dimensões inválidas (16 a ${MAX_GENERATED_SIDE} px)`);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = spec.color;
  shapePath(ctx, spec.shape, size);
  ctx.fill();
  return canvas.toBuffer('image/png');
}
