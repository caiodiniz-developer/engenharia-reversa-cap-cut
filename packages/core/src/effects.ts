import { newId } from './ids';
import { applyLut, mixLut, type Lut3D } from './lut';
import type { EffectInstance } from './schema';

/**
 * Registro declarativo de efeitos. Cada efeito traz:
 *  - parâmetros (limites e padrões);
 *  - `ffmpeg`: fragmentos de filtro usados na exportação;
 *  - `pixel`: a mesma operação sobre RGBA, usada no preview do navegador e nos testes de paridade.
 *
 * Efeitos "opacos" rodam antes de o clipe ganhar canal alfa; `alpha: true` (chroma key) roda depois.
 */

export type Pixels = Uint8ClampedArray;
export type Params = Record<string, number>;

export interface EffectParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface EffectCtx {
  width: number;
  height: number;
  /** Caminho do arquivo .cube já gravado para o efeito de LUT (a exportação prepara antes de montar o grafo). */
  lutPath?: (fx: EffectInstance) => string | undefined;
}

/** Dados auxiliares de um efeito no preview (ex.: a LUT já resolvida). */
export interface PixelEnv {
  lut?: Lut3D;
}

export interface EffectDef {
  type: string;
  label: string;
  category: 'color' | 'blur' | 'stylize' | 'key' | 'look';
  params: EffectParamDef[];
  /** true quando a saída ganha/usa canal alfa (precisa rodar em rgba). */
  alpha?: boolean;
  ffmpeg(params: Params, ctx: EffectCtx, fx: EffectInstance): string[];
  pixel(data: Pixels, w: number, h: number, params: Params, env?: PixelEnv): void;
}

/** Escapa um caminho para uso dentro de aspas simples em um filtro do FFmpeg (inclui o ':' de "C:"). */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const num = (n: number) => Number(n.toFixed(6)).toString();

function def(
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
): EffectParamDef {
  return { key, label, min, max, step, default: value };
}

/** Gaussiana separável (borda replicada). */
function gaussianBlur(data: Pixels, w: number, h: number, sigma: number, channels = 4): void {
  if (sigma <= 0.01) return;
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i]! /= sum;
  const tmp = new Float32Array(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < channels; c++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.min(w - 1, Math.max(0, x + k));
          acc += data[(y * w + xx) * 4 + c]! * kernel[k + radius]!;
        }
        tmp[(y * w + x) * 4 + c] = acc;
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < channels; c++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.min(h - 1, Math.max(0, y + k));
          acc += tmp[(yy * w + x) * 4 + c]! * kernel[k + radius]!;
        }
        data[(y * w + x) * 4 + c] = acc;
      }
}

const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

export const EFFECTS: EffectDef[] = [
  {
    type: 'brightness',
    label: 'Brilho',
    category: 'color',
    params: [def('amount', 'Brilho', -1, 1, 0.01, 0)],
    ffmpeg: (p) => {
      const e = `clip(val/maxval+${num(p.amount ?? 0)},0,1)*maxval`;
      return [`lutrgb=r='${e}':g='${e}':b='${e}'`];
    },
    pixel(d, _w, _h, p) {
      const b = p.amount ?? 0;
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = clamp01(d[i + c]! / 255 + b) * 255;
    },
  },
  {
    type: 'contrast',
    label: 'Contraste',
    category: 'color',
    params: [def('amount', 'Contraste', 0, 3, 0.01, 1)],
    ffmpeg: (p) => {
      const e = `clip((val/maxval-0.5)*${num(p.amount ?? 1)}+0.5,0,1)*maxval`;
      return [`lutrgb=r='${e}':g='${e}':b='${e}'`];
    },
    pixel(d, _w, _h, p) {
      const k = p.amount ?? 1;
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = clamp01((d[i + c]! / 255 - 0.5) * k + 0.5) * 255;
    },
  },
  {
    type: 'exposure',
    label: 'Exposição',
    category: 'color',
    params: [def('stops', 'Exposição (EV)', -3, 3, 0.05, 0)],
    ffmpeg: (p) => {
      const e = `clip(val*${num(2 ** (p.stops ?? 0))},0,maxval)`;
      return [`lutrgb=r='${e}':g='${e}':b='${e}'`];
    },
    pixel(d, _w, _h, p) {
      const k = 2 ** (p.stops ?? 0);
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, d[i + c]! * k);
    },
  },
  {
    type: 'saturation',
    label: 'Saturação',
    category: 'color',
    params: [def('amount', 'Saturação', 0, 3, 0.01, 1)],
    ffmpeg: (p) => {
      const s = p.amount ?? 1;
      const m = (w: number, diag: boolean) => num(diag ? (1 - s) * w + s : (1 - s) * w);
      const { r, g, b } = LUMA;
      return [
        `colorchannelmixer=rr=${m(r, true)}:rg=${m(g, false)}:rb=${m(b, false)}:gr=${m(r, false)}:gg=${m(g, true)}:gb=${m(b, false)}:br=${m(r, false)}:bg=${m(g, false)}:bb=${m(b, true)}`,
      ];
    },
    pixel(d, _w, _h, p) {
      const s = p.amount ?? 1;
      for (let i = 0; i < d.length; i += 4) {
        const y = LUMA.r * d[i]! + LUMA.g * d[i + 1]! + LUMA.b * d[i + 2]!;
        for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.max(0, y + (d[i + c]! - y) * s));
      }
    },
  },
  {
    type: 'temperature',
    label: 'Temperatura',
    category: 'color',
    params: [def('amount', 'Frio ↔ Quente', -1, 1, 0.01, 0)],
    ffmpeg: (p) => {
      const t = p.amount ?? 0;
      return [
        `lutrgb=r='clip(val*${num(1 + 0.25 * t)},0,maxval)':b='clip(val*${num(1 - 0.25 * t)},0,maxval)'`,
      ];
    },
    pixel(d, _w, _h, p) {
      const t = p.amount ?? 0;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i]! * (1 + 0.25 * t));
        d[i + 2] = Math.min(255, d[i + 2]! * (1 - 0.25 * t));
      }
    },
  },
  {
    type: 'blur',
    label: 'Desfoque',
    category: 'blur',
    params: [def('sigma', 'Intensidade', 0, 40, 0.5, 0)],
    ffmpeg: (p) => ((p.sigma ?? 0) > 0 ? [`gblur=sigma=${num(p.sigma ?? 0)}:steps=3`] : []),
    pixel: (d, w, h, p) => gaussianBlur(d, w, h, p.sigma ?? 0, 3),
  },
  {
    type: 'sharpen',
    label: 'Nitidez',
    category: 'blur',
    params: [def('amount', 'Intensidade', 0, 3, 0.05, 0)],
    ffmpeg: (p) => ((p.amount ?? 0) > 0 ? [`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${num(p.amount ?? 0)}:chroma_amount=0`] : []),
    pixel(d, w, h, p) {
      const a = p.amount ?? 0;
      if (a <= 0) return;
      const blurred = new Uint8ClampedArray(d);
      gaussianBlur(blurred, w, h, 1.2, 3);
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = d[i + c]! + (d[i + c]! - blurred[i + c]!) * a;
    },
  },
  {
    type: 'vignette',
    label: 'Vinheta',
    category: 'stylize',
    params: [def('amount', 'Intensidade', 0, 1, 0.01, 0)],
    ffmpeg: (p) => {
      const k = num(p.amount ?? 0);
      const f = `(1-${k}*pow(hypot(X-W/2,Y-H/2)/hypot(W/2,H/2),2))`;
      return (p.amount ?? 0) > 0 ? [`geq=r='r(X,Y)*${f}':g='g(X,Y)*${f}':b='b(X,Y)*${f}'`] : [];
    },
    pixel(d, w, h, p) {
      const a = p.amount ?? 0;
      if (a <= 0) return;
      const maxd = Math.hypot(w / 2, h / 2);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const f = 1 - a * (Math.hypot(x - w / 2, y - h / 2) / maxd) ** 2;
          const i = (y * w + x) * 4;
          d[i] = d[i]! * f;
          d[i + 1] = d[i + 1]! * f;
          d[i + 2] = d[i + 2]! * f;
        }
    },
  },
  {
    type: 'grain',
    label: 'Granulação',
    category: 'stylize',
    params: [def('amount', 'Intensidade', 0, 1, 0.01, 0)],
    ffmpeg: (p) => ((p.amount ?? 0) > 0 ? [`noise=alls=${Math.round((p.amount ?? 0) * 40)}:allf=t`] : []),
    pixel(d, _w, _h, p) {
      const a = (p.amount ?? 0) * 40;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() * 2 - 1) * a;
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c]! + n;
      }
    },
  },
  {
    type: 'aberration',
    label: 'Aberração cromática',
    category: 'stylize',
    params: [def('px', 'Deslocamento (px)', 0, 40, 1, 0)],
    ffmpeg: (p) => {
      const k = Math.round(p.px ?? 0);
      return k > 0 ? [`rgbashift=rh=${-k}:bh=${k}:edge=smear`] : [];
    },
    pixel(d, w, h, p) {
      const k = Math.round(p.px ?? 0);
      if (k <= 0) return;
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          d[i] = src[(y * w + Math.min(w - 1, Math.max(0, x + k))) * 4]!;
          d[i + 2] = src[(y * w + Math.min(w - 1, Math.max(0, x - k))) * 4 + 2]!;
        }
    },
  },
  {
    type: 'glitch',
    label: 'Glitch',
    category: 'stylize',
    params: [def('amount', 'Intensidade', 0, 1, 0.01, 0)],
    ffmpeg: (p) => {
      const a = p.amount ?? 0;
      if (a <= 0) return [];
      const k = Math.max(1, Math.round(a * 24));
      return [`rgbashift=rh=${-k}:bh=${k}:gv=${Math.round(k / 2)}:edge=smear`, `noise=alls=${Math.round(a * 30)}:allf=t`];
    },
    pixel(d, w, h, p) {
      const a = p.amount ?? 0;
      if (a <= 0) return;
      const k = Math.max(1, Math.round(a * 24));
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          d[i] = src[(y * w + Math.min(w - 1, Math.max(0, x + k))) * 4]!;
          d[i + 2] = src[(y * w + Math.min(w - 1, Math.max(0, x - k))) * 4 + 2]!;
          d[i + 1] = src[(Math.min(h - 1, Math.max(0, y - Math.round(k / 2))) * w + x) * 4 + 1]!;
          const n = (Math.random() * 2 - 1) * a * 30;
          for (let c = 0; c < 3; c++) d[i + c] = d[i + c]! + n;
        }
    },
  },
  {
    type: 'lut',
    label: 'LUT de cor',
    category: 'look',
    params: [def('intensity', 'Intensidade', 0, 1, 0.01, 1)],
    // O arquivo .cube (já misturado com a identidade conforme a intensidade) é gravado pela exportação.
    ffmpeg: (_p, ctx, fx) => {
      const file = ctx.lutPath?.(fx);
      return file ? [`lut3d=file='${escapeFilterPath(file)}':interp=trilinear`] : [];
    },
    pixel(d, _w, _h, p, env) {
      if (env?.lut) applyLut(d, mixLut(env.lut, p.intensity ?? 1));
    },
  },
  {
    type: 'chromakey',
    label: 'Chroma key',
    category: 'key',
    alpha: true,
    params: [
      def('r', 'Cor R', 0, 255, 1, 0),
      def('g', 'Cor G', 0, 255, 1, 255),
      def('b', 'Cor B', 0, 255, 1, 0),
      def('similarity', 'Tolerância', 0.01, 1, 0.01, 0.3),
      def('blend', 'Suavização', 0, 1, 0.01, 0.1),
    ],
    ffmpeg: (p) => {
      const hex = [p.r ?? 0, p.g ?? 255, p.b ?? 0].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      return [`colorkey=color=0x${hex}:similarity=${num(p.similarity ?? 0.3)}:blend=${num(p.blend ?? 0.1)}`];
    },
    pixel(d, _w, _h, p) {
      const kr = p.r ?? 0;
      const kg = p.g ?? 255;
      const kb = p.b ?? 0;
      const sim = p.similarity ?? 0.3;
      const blend = p.blend ?? 0.1;
      for (let i = 0; i < d.length; i += 4) {
        const diff = Math.sqrt(((d[i]! - kr) ** 2 + (d[i + 1]! - kg) ** 2 + (d[i + 2]! - kb) ** 2) / (255 * 255 * 3));
        const alpha = blend > 0.0001 ? clamp01((diff - sim) / blend) : diff > sim ? 1 : 0;
        d[i + 3] = d[i + 3]! * alpha;
      }
    },
  },
];

const BY_TYPE = new Map(EFFECTS.map((e) => [e.type, e]));

export const getEffectDef = (type: string): EffectDef | undefined => BY_TYPE.get(type);

export function defaultParams(type: string): Params {
  const d = BY_TYPE.get(type);
  if (!d) throw new Error(`Efeito desconhecido: ${type}`);
  return Object.fromEntries(d.params.map((p) => [p.key, p.default]));
}

export function createEffect(type: string, params: Params = {}, ref?: string): EffectInstance {
  return { id: newId('fx'), type, enabled: true, params: { ...defaultParams(type), ...clampParams(type, params) }, ...(ref ? { ref } : {}) };
}

/** Limita valores aos intervalos declarados; descarta chaves desconhecidas. */
export function clampParams(type: string, params: Params): Params {
  const d = BY_TYPE.get(type);
  if (!d) throw new Error(`Efeito desconhecido: ${type}`);
  const out: Params = {};
  for (const def of d.params) {
    const v = params[def.key];
    if (v !== undefined && Number.isFinite(v)) out[def.key] = Math.min(def.max, Math.max(def.min, v));
  }
  return out;
}

/** Efeitos habilitados, na ordem de aplicação: opacos primeiro, os que usam alfa por último. */
export function orderedEffects(effects: EffectInstance[]): EffectInstance[] {
  const enabled = effects.filter((e) => e.enabled && BY_TYPE.has(e.type));
  return [...enabled.filter((e) => !BY_TYPE.get(e.type)!.alpha), ...enabled.filter((e) => BY_TYPE.get(e.type)!.alpha)];
}

/** Aplica os efeitos de um clipe a um buffer RGBA (preview). `resolveLut` entrega a LUT de um efeito de LUT. */
export function applyEffectsToPixels(data: Pixels, w: number, h: number, effects: EffectInstance[], resolveLut?: (ref: string | undefined) => Lut3D | undefined): void {
  for (const e of orderedEffects(effects)) {
    BY_TYPE.get(e.type)!.pixel(data, w, h, { ...defaultParams(e.type), ...e.params }, e.type === 'lut' ? { lut: resolveLut?.(e.ref) } : undefined);
  }
}

/** Fragmentos de filtro FFmpeg para os efeitos habilitados; `alpha` seleciona o grupo. */
export function effectsToFfmpeg(effects: EffectInstance[], ctx: EffectCtx, alpha: boolean): string[] {
  return orderedEffects(effects)
    .filter((e) => !!BY_TYPE.get(e.type)!.alpha === alpha)
    .flatMap((e) => BY_TYPE.get(e.type)!.ffmpeg({ ...defaultParams(e.type), ...e.params }, ctx, e));
}

export interface EffectPreset {
  id: string;
  label: string;
  effects: Array<{ type: string; params: Params }>;
}

/** "Looks" prontos, compostos apenas pelos efeitos acima (sem LUTs de terceiros). */
export const PRESETS: EffectPreset[] = [
  { id: 'cinematic', label: 'Cinemático', effects: [{ type: 'contrast', params: { amount: 1.15 } }, { type: 'saturation', params: { amount: 0.85 } }, { type: 'temperature', params: { amount: -0.15 } }, { type: 'vignette', params: { amount: 0.5 } }] },
  { id: 'vintage', label: 'Vintage', effects: [{ type: 'saturation', params: { amount: 0.7 } }, { type: 'temperature', params: { amount: 0.35 } }, { type: 'grain', params: { amount: 0.3 } }, { type: 'vignette', params: { amount: 0.4 } }] },
  { id: 'bw', label: 'Preto e branco', effects: [{ type: 'saturation', params: { amount: 0 } }, { type: 'contrast', params: { amount: 1.2 } }] },
  { id: 'vivid', label: 'Vívido', effects: [{ type: 'saturation', params: { amount: 1.5 } }, { type: 'contrast', params: { amount: 1.1 } }] },
  { id: 'dream', label: 'Sonho', effects: [{ type: 'blur', params: { sigma: 2 } }, { type: 'brightness', params: { amount: 0.08 } }, { type: 'saturation', params: { amount: 1.2 } }] },
];

export function presetToEffects(id: string): EffectInstance[] {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Preset desconhecido: ${id}`);
  return preset.effects.map((e) => createEffect(e.type, e.params));
}
