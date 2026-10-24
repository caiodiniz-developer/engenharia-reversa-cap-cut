import { createCanvas } from '@napi-rs/canvas';
import { displayText, drawLayout, layoutText, type Ctx2DLike, type TextStyle } from '@editor/core';

export interface TextBitmap {
  png: Buffer;
  width: number;
  height: number;
}

/** Renderiza o texto (com estilo) em um PNG com fundo transparente, usando o mesmo desenho do preview. */
export function renderTextPng(
  text: string,
  style: TextStyle,
  frame: { width: number; height: number },
  opts: { words?: Array<{ text: string }>; highlightIndex?: number; highlightColor?: string } = {},
): TextBitmap {
  const measure = createCanvas(8, 8).getContext('2d') as unknown as Ctx2DLike;
  const layout = layoutText(measure, displayText(text, opts.words), style, frame.width, frame.height);
  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext('2d') as unknown as Ctx2DLike;
  drawLayout(ctx, layout, style, frame.height, { highlightIndex: opts.highlightIndex, highlightColor: opts.highlightColor });
  return { png: canvas.toBuffer('image/png'), width: layout.width, height: layout.height };
}

/** Mede o texto sem desenhar (usado para obter o tamanho natural do bitmap). */
export function measureText(text: string, style: TextStyle, frame: { width: number; height: number }, words?: Array<{ text: string }>) {
  const measure = createCanvas(8, 8).getContext('2d') as unknown as Ctx2DLike;
  const l = layoutText(measure, displayText(text, words), style, frame.width, frame.height);
  return { width: l.width, height: l.height };
}
