import type { TextStyle } from './schema';

/**
 * Desenho de texto compartilhado entre o preview (CanvasRenderingContext2D) e a exportação
 * (@napi-rs/canvas): ambos chamam as mesmas funções, então o resultado visual é o mesmo.
 */

export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}

/** Subconjunto da API Canvas 2D usado aqui. */
export interface Ctx2DLike {
  font: string;
  fillStyle: string | GradientLike | unknown;
  strokeStyle: string | unknown;
  lineWidth: number;
  lineJoin: 'round' | 'miter' | 'bevel' | string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  textBaseline: string;
  textAlign: string;
  measureText(text: string): { width: number };
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
}

export interface TextLayout {
  /** Dimensões do bitmap (inclui margem para contorno/sombra). */
  width: number;
  height: number;
  pad: number;
  fontPx: number;
  lineHeight: number;
  fontString: string;
  /** Palavras posicionadas (x relativo ao início da linha, y = índice da linha). */
  lines: Array<{ width: number; words: Array<{ text: string; x: number; index: number }> }>;
  textWidth: number;
  textHeight: number;
}

export function fontString(style: TextStyle, fontPx: number): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${Math.round(fontPx * 100) / 100}px ${style.fontFamily}`;
}

/** Texto exibido: para legendas com palavras, a concatenação delas (garante índice de destaque coerente). */
export function displayText(text: string, words?: Array<{ text: string }>): string {
  return words && words.length ? words.map((w) => w.text).join(' ') : text;
}

export function layoutText(ctx: Ctx2DLike, text: string, style: TextStyle, frameW: number, frameH: number): TextLayout {
  const k = frameH / 1080;
  const fontPx = style.fontSize * k;
  const strokePx = style.strokeWidth * k;
  const shadowBlur = style.shadowBlur * k;
  const shadowX = style.shadowX * k;
  const shadowY = style.shadowY * k;
  ctx.font = fontString(style, fontPx);
  const space = ctx.measureText(' ').width;
  const maxW = Math.max(fontPx, style.maxWidth * frameW);

  const lines: TextLayout['lines'] = [];
  let index = 0;
  for (const paragraph of text.split('\n')) {
    let cur: TextLayout['lines'][number] = { width: 0, words: [] };
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const w = ctx.measureText(word).width;
      const nextW = cur.words.length ? cur.width + space + w : w;
      if (cur.words.length && nextW > maxW) {
        lines.push(cur);
        cur = { width: 0, words: [] };
      }
      const x = cur.words.length ? cur.width + space : 0;
      cur.words.push({ text: word, x, index: index++ });
      cur.width = x + w;
    }
    lines.push(cur);
  }

  const lineHeight = fontPx * 1.2;
  const textWidth = Math.max(1, ...lines.map((l) => l.width));
  const textHeight = lines.length * lineHeight;
  const bgPad = style.background ? fontPx * 0.25 : 0;
  const pad = Math.ceil(strokePx + shadowBlur * 2 + Math.max(Math.abs(shadowX), Math.abs(shadowY)) + bgPad + 2);
  return {
    width: Math.ceil(textWidth + pad * 2),
    height: Math.ceil(textHeight + pad * 2),
    pad,
    fontPx,
    lineHeight,
    fontString: ctx.font,
    lines,
    textWidth,
    textHeight,
  };
}

/** Desenha o layout no contexto (origem no canto superior esquerdo do bitmap). */
export function drawLayout(
  ctx: Ctx2DLike,
  layout: TextLayout,
  style: TextStyle,
  frameH: number,
  opts: { highlightIndex?: number; highlightColor?: string } = {},
): void {
  const k = frameH / 1080;
  const strokePx = style.strokeWidth * k;
  ctx.font = layout.fontString;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';

  if (style.background) {
    const padBg = layout.fontPx * 0.25;
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = style.background;
    ctx.fillRect(layout.pad - padBg, layout.pad - padBg, layout.textWidth + padBg * 2, layout.textHeight + padBg * 2);
  }

  const baseFill: string | GradientLike = style.gradientTo
    ? (() => {
        const g = ctx.createLinearGradient(0, layout.pad, 0, layout.pad + layout.textHeight);
        g.addColorStop(0, style.color);
        g.addColorStop(1, style.gradientTo);
        return g;
      })()
    : style.color;

  const alignOffset = (lineW: number) =>
    style.align === 'center' ? (layout.textWidth - lineW) / 2 : style.align === 'right' ? layout.textWidth - lineW : 0;

  // 1) contorno + sombra, 2) preenchimento por palavra (para destacar uma palavra).
  const each = (fn: (text: string, x: number, y: number, index: number) => void) => {
    layout.lines.forEach((line, li) => {
      const y = layout.pad + li * layout.lineHeight + layout.lineHeight / 2;
      const ox = layout.pad + alignOffset(line.width);
      for (const w of line.words) fn(w.text, ox + w.x, y, w.index);
    });
  };

  if (strokePx > 0) {
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = strokePx * 2;
    ctx.shadowColor = style.shadowBlur > 0 || style.shadowX || style.shadowY ? style.shadowColor : 'rgba(0,0,0,0)';
    ctx.shadowBlur = style.shadowBlur * k;
    ctx.shadowOffsetX = style.shadowX * k;
    ctx.shadowOffsetY = style.shadowY * k;
    each((t, x, y) => ctx.strokeText(t, x, y));
  }

  const hasShadow = style.shadowBlur > 0 || style.shadowX !== 0 || style.shadowY !== 0;
  ctx.shadowColor = hasShadow && strokePx === 0 ? style.shadowColor : 'rgba(0,0,0,0)';
  ctx.shadowBlur = hasShadow && strokePx === 0 ? style.shadowBlur * k : 0;
  ctx.shadowOffsetX = hasShadow && strokePx === 0 ? style.shadowX * k : 0;
  ctx.shadowOffsetY = hasShadow && strokePx === 0 ? style.shadowY * k : 0;
  each((t, x, y, i) => {
    ctx.fillStyle = opts.highlightIndex === i && opts.highlightColor ? opts.highlightColor : baseFill;
    ctx.fillText(t, x, y);
  });
}
