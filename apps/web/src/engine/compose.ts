import {
  applyEffectsToPixels,
  clipEnd,
  displayText,
  drawLayout,
  layoutText,
  resolveLut,
  resolveTransform,
  type CaptionClip,
  type Clip,
  type Ctx2DLike,
  type MediaClip,
  type Project,
  type TextClip,
  type TextLayout,
  type Track,
} from '@editor/core';

/**
 * Composição de um quadro do preview em Canvas 2D. Usa as mesmas funções do núcleo que a exportação
 * (resolução de keyframes, ordem de efeitos, desenho de texto), de modo que as duas saídas partam das
 * mesmas definições. Diferenças: o preview roda em resolução reduzida e o motor de efeitos é o em pixels.
 */

export interface FrameSource {
  /** Elemento com o quadro já posicionado no instante pedido, ou undefined se ainda indisponível. */
  video?: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number };
}

export interface ComposeInput {
  project: Project;
  time: number;
  width: number;
  height: number;
  /** Resolve a fonte visual de um clipe de mídia (vídeo/imagem) para este instante. */
  source(clip: MediaClip): FrameSource | undefined;
}

const ease = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Progresso suavizado da transição de entrada de um clipe (0..1) no tempo dado. */
export function transitionProgress(clip: MediaClip, time: number): number {
  const tr = clip.transitionIn;
  if (!tr) return 1;
  return clamp01((time - clip.start) / tr.duration);
}

export function mediaSize(src: FrameSource['video']): { w: number; h: number } {
  const v = src as { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return { w: v.videoWidth || v.naturalWidth || (v.width as number) || 0, h: v.videoHeight || v.naturalHeight || (v.height as number) || 0 };
}

let scratch: HTMLCanvasElement | OffscreenCanvas | undefined;
function scratchCanvas(w: number, h: number): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (!scratch) scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  return scratch.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
}

const textCache = new Map<string, { canvas: HTMLCanvasElement | OffscreenCanvas; layout: TextLayout }>();

function renderTextBitmap(clip: TextClip | CaptionClip, frameW: number, frameH: number, highlightIndex?: number) {
  const words = clip.type === 'caption' ? clip.words : undefined;
  const text = displayText(clip.text, words);
  const key = JSON.stringify([text, clip.style, frameW, frameH, highlightIndex, clip.type === 'caption' ? clip.highlightColor : undefined]);
  const hit = textCache.get(key);
  if (hit) return hit;
  const measure = scratchMeasure();
  const layout = layoutText(measure as unknown as Ctx2DLike, text, clip.style, frameW, frameH);
  const canvas: HTMLCanvasElement | OffscreenCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(layout.width, layout.height) : Object.assign(document.createElement('canvas'), { width: layout.width, height: layout.height });
  const ctx = canvas.getContext('2d') as unknown as Ctx2DLike | null;
  if (ctx) drawLayout(ctx, layout, clip.style, frameH, { highlightIndex, highlightColor: clip.type === 'caption' ? clip.highlightColor : undefined });
  if (textCache.size > 200) textCache.clear();
  const entry = { canvas, layout };
  textCache.set(key, entry);
  return entry;
}

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
function scratchMeasure() {
  if (measureCtx === undefined) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
    measureCtx = c.getContext('2d') as CanvasRenderingContext2D | null;
  }
  return measureCtx as CanvasRenderingContext2D;
}

type Ctx = CanvasRenderingContext2D;

export function composeFrame(ctx: Ctx, input: ComposeInput): void {
  const { project, time, width: W, height: H } = input;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = project.settings.background;
  ctx.fillRect(0, 0, W, H);

  // A faixa de índice 0 é a camada mais alta: desenhamos de baixo para cima.
  for (let ti = project.tracks.length - 1; ti >= 0; ti--) {
    const track = project.tracks[ti]!;
    if (track.hidden) continue;
    for (const clip of track.clips) {
      if (time < clip.start - 1e-9 || time >= clipEnd(clip) - 1e-9) continue;
      if (clip.type === 'media') drawMedia(ctx, track, clip, input);
      else drawText(ctx, clip, input);
    }
  }
  ctx.restore();
}

function drawMedia(ctx: Ctx, track: Track, clip: MediaClip, input: ComposeInput): void {
  if (track.kind !== 'video') return;
  const src = input.source(clip);
  if (!src?.video) return;
  const { w: sw, h: sh } = mediaSize(src.video);
  if (!sw || !sh) return;
  const { width: W, height: H, time } = input;
  const local = time - clip.start;
  const t = resolveTransform(clip, local);

  const cl = t.crop.l * sw;
  const ct = t.crop.t * sh;
  const cw = sw * (1 - t.crop.l - t.crop.r);
  const ch = sh * (1 - t.crop.t - t.crop.b);
  const fit = Math.min(W / cw, H / ch);
  const dw = cw * fit * t.scale;
  const dh = ch * fit * t.scale;

  // Ajuste de quadro intermediário (para efeitos por pixel), no tamanho de destino.
  const ow = Math.max(2, Math.round(dw));
  const oh = Math.max(2, Math.round(dh));
  const sctx = scratchCanvas(ow, oh);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, ow, oh);
  sctx.save();
  if (t.flipH || t.flipV) {
    sctx.translate(t.flipH ? ow : 0, t.flipV ? oh : 0);
    sctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  }
  sctx.drawImage(src.video, cl, ct, cw, ch, 0, 0, ow, oh);
  sctx.restore();

  const hasEffects = clip.effects.some((e) => e.enabled);
  if (hasEffects) {
    const img = sctx.getImageData(0, 0, ow, oh);
    applyEffectsToPixels(img.data, ow, oh, clip.effects, (ref) => resolveLut(input.project.luts, ref));
    sctx.putImageData(img, 0, 0);
  }

  if (clip.mask) applyMask(sctx, clip, ow, oh);

  // Transição de entrada.
  let alpha = t.opacity;
  let ox = 0;
  let oy = 0;
  let wipe: { dir: 'left' | 'right'; p: number } | undefined;
  const tr = clip.transitionIn;
  if (tr && time < clip.start + tr.duration) {
    const p = clamp01((time - clip.start) / tr.duration);
    const e = ease(p);
    switch (tr.type) {
      case 'fade':
        alpha *= p;
        break;
      case 'slide-left':
        ox = (1 - e) * W;
        break;
      case 'slide-right':
        ox = -(1 - e) * W;
        break;
      case 'slide-up':
        oy = (1 - e) * H;
        break;
      case 'slide-down':
        oy = -(1 - e) * H;
        break;
      case 'wipe-left':
        wipe = { dir: 'left', p };
        break;
      case 'wipe-right':
        wipe = { dir: 'right', p };
        break;
    }
  }

  const cx = W / 2 + t.x * W + ox;
  const cy = H / 2 + t.y * H + oy;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
  if (wipe) {
    // O recorte acompanha o quadro da tela (antes da rotação seria impreciso; wipes usam o quadro).
    ctx.save();
    ctx.rotate(-(t.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    ctx.beginPath();
    if (wipe.dir === 'right') ctx.rect(0, 0, W * wipe.p, H);
    else ctx.rect(W * (1 - wipe.p), 0, W * wipe.p, H);
    ctx.clip();
    ctx.translate(cx, cy);
    if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
  }
  ctx.drawImage(scratch as CanvasImageSource, 0, 0, ow, oh, -dw / 2, -dh / 2, dw, dh);
  if (wipe) ctx.restore();
  ctx.restore();
}

function applyMask(c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, clip: MediaClip, w: number, h: number): void {
  const m = clip.mask!;
  const cx = m.cx * w;
  const cy = m.cy * h;
  const rw = (m.w * w) / 2;
  const rh = (m.h * h) / 2;
  c.save();
  c.globalCompositeOperation = m.invert ? 'destination-out' : 'destination-in';
  c.fillStyle = '#000';
  c.beginPath();
  if (m.shape === 'ellipse') c.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  else c.rect(cx - rw, cy - rh, rw * 2, rh * 2);
  c.fill();
  c.restore();
}

function drawText(ctx: Ctx, clip: TextClip | CaptionClip, input: ComposeInput): void {
  const { width: W, height: H, time } = input;
  const local = time - clip.start;
  let highlight: number | undefined;
  if (clip.type === 'caption' && clip.highlightColor && clip.words.length) {
    const i = clip.words.findIndex((w) => local >= w.start && local < w.end);
    if (i >= 0) highlight = i;
  }
  const { canvas, layout } = renderTextBitmap(clip, W, H, highlight);
  const t = resolveTransform(clip, local);

  let alpha = t.opacity;
  let scale = t.scale;
  let dy = 0;
  const aIn = clip.animationIn;
  const aOut = clip.animationOut;
  if (aIn.type !== 'none' && aIn.duration > 0 && local < aIn.duration) {
    const p = clamp01(local / aIn.duration);
    if (aIn.type === 'fade') alpha *= p;
    if (aIn.type === 'pop') scale *= 0.6 + 0.4 * ease(p);
    if (aIn.type === 'slide-up') dy += (1 - ease(p)) * 0.08 * H;
    if (aIn.type === 'slide-down') dy -= (1 - ease(p)) * 0.08 * H;
  }
  const outStart = clip.duration - aOut.duration;
  if (aOut.type !== 'none' && aOut.duration > 0 && local > outStart) {
    const p = clamp01((local - outStart) / aOut.duration);
    if (aOut.type === 'fade') alpha *= 1 - p;
    if (aOut.type === 'slide-up') dy -= ease(p) * 0.08 * H;
    if (aOut.type === 'slide-down') dy += ease(p) * 0.08 * H;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + t.x * W, H / 2 + t.y * H + dy);
  if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.drawImage(canvas as CanvasImageSource, (-layout.width * scale) / 2, (-layout.height * scale) / 2, layout.width * scale, layout.height * scale);
  ctx.restore();
}

/** Clipes de mídia visíveis no instante (para o motor decidir quais elementos <video> posicionar). */
export function activeMediaClips(project: Project, time: number): Array<{ clip: MediaClip; track: Track }> {
  const out: Array<{ clip: MediaClip; track: Track }> = [];
  for (const track of project.tracks)
    for (const c of track.clips as Clip[]) {
      if (c.type === 'media' && time >= c.start - 1e-9 && time < clipEnd(c) - 1e-9) out.push({ clip: c, track });
    }
  return out;
}
