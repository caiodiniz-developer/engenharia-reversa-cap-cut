import type { Pixels } from './effects';

/**
 * LUTs 3D (formato .cube). `data` guarda size³ entradas RGB (0..1) com o canal R variando mais rápido,
 * como no formato .cube e no filtro lut3d do FFmpeg.
 */
export interface Lut3D {
  title: string;
  size: number;
  data: Float32Array;
}

export class LutError extends Error {}

export const MAX_LUT_SIZE = 65;

export function parseCube(text: string): Lut3D {
  let size = 0;
  let title = '';
  const dmin = [0, 0, 0];
  const dmax = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(/\s+/);
    switch (key) {
      case 'TITLE':
        title = rest.join(' ').replace(/^"|"$/g, '');
        break;
      case 'LUT_3D_SIZE':
        size = Number(rest[0]);
        break;
      case 'LUT_1D_SIZE':
        throw new LutError('LUT 1D não é suportada; use uma LUT 3D (.cube com LUT_3D_SIZE)');
      case 'DOMAIN_MIN':
        rest.forEach((v, i) => (dmin[i] = Number(v)));
        break;
      case 'DOMAIN_MAX':
        rest.forEach((v, i) => (dmax[i] = Number(v)));
        break;
      default: {
        const nums = line.split(/\s+/).map(Number);
        if (nums.length === 3 && nums.every(Number.isFinite)) rows.push(...nums);
        else if (!/^[A-Z_]+$/.test(key!)) throw new LutError(`Linha inválida na LUT: "${line.slice(0, 40)}"`);
      }
    }
  }
  if (!Number.isInteger(size) || size < 2 || size > MAX_LUT_SIZE) throw new LutError(`LUT_3D_SIZE inválido (2 a ${MAX_LUT_SIZE})`);
  if (rows.length !== size ** 3 * 3) throw new LutError(`A LUT declara ${size}³ entradas mas contém ${rows.length / 3}`);
  const data = new Float32Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const c = i % 3;
    const range = dmax[c]! - dmin[c]! || 1;
    data[i] = Math.min(1, Math.max(0, (rows[i]! - dmin[c]!) / range));
  }
  return { title, size, data };
}

export function serializeCube(lut: Lut3D): string {
  const lines = [`TITLE "${lut.title || 'LUT'}"`, `LUT_3D_SIZE ${lut.size}`];
  for (let i = 0; i < lut.data.length; i += 3) lines.push(`${lut.data[i]!.toFixed(6)} ${lut.data[i + 1]!.toFixed(6)} ${lut.data[i + 2]!.toFixed(6)}`);
  return `${lines.join('\n')}\n`;
}

export function identityLut(size: number): Lut3D {
  const data = new Float32Array(size ** 3 * 3);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        data[i++] = r / (size - 1);
        data[i++] = g / (size - 1);
        data[i++] = b / (size - 1);
      }
  return { title: 'Identidade', size, data };
}

/** Mistura a LUT com a identidade: intensity 0 = sem efeito, 1 = LUT completa. */
export function mixLut(lut: Lut3D, intensity: number): Lut3D {
  if (intensity >= 0.9999) return lut;
  const id = identityLut(lut.size);
  const data = new Float32Array(lut.data.length);
  for (let i = 0; i < data.length; i++) data[i] = id.data[i]! + (lut.data[i]! - id.data[i]!) * intensity;
  return { title: lut.title, size: lut.size, data };
}

/** Interpolação trilinear (a mesma do `lut3d=interp=trilinear` na exportação). */
export function applyLut(px: Pixels, lut: Lut3D): void {
  const n = lut.size;
  const max = n - 1;
  const d = lut.data;
  const at = (r: number, g: number, b: number, c: number) => d[((b * n + g) * n + r) * 3 + c]!;
  for (let i = 0; i < px.length; i += 4) {
    const fr = (px[i]! / 255) * max;
    const fg = (px[i + 1]! / 255) * max;
    const fb = (px[i + 2]! / 255) * max;
    const r0 = Math.min(max - 1, Math.floor(fr));
    const g0 = Math.min(max - 1, Math.floor(fg));
    const b0 = Math.min(max - 1, Math.floor(fb));
    const dr = fr - r0;
    const dg = fg - g0;
    const db = fb - b0;
    for (let c = 0; c < 3; c++) {
      const c00 = at(r0, g0, b0, c) * (1 - dr) + at(r0 + 1, g0, b0, c) * dr;
      const c10 = at(r0, g0 + 1, b0, c) * (1 - dr) + at(r0 + 1, g0 + 1, b0, c) * dr;
      const c01 = at(r0, g0, b0 + 1, c) * (1 - dr) + at(r0 + 1, g0, b0 + 1, c) * dr;
      const c11 = at(r0, g0 + 1, b0 + 1, c) * (1 - dr) + at(r0 + 1, g0 + 1, b0 + 1, c) * dr;
      const v = (c00 * (1 - dg) + c10 * dg) * (1 - db) + (c01 * (1 - dg) + c11 * dg) * db;
      px[i + c] = v * 255;
    }
  }
}

// ---- LUTs embutidas, geradas por funções matemáticas próprias (sem LUTs de terceiros) ----

type RGB = [number, number, number];
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (x: number) => x * x * (3 - 2 * x);

export const BUILTIN_LUTS: Array<{ id: string; label: string; fn: (c: RGB) => RGB }> = [
  {
    id: 'teal-orange',
    label: 'Azul-petróleo e laranja',
    fn: (c) => {
      const y = luma(c);
      const shadow = 1 - smooth(clamp(y * 1.3));
      const high = smooth(clamp((y - 0.15) * 1.5));
      return [clamp(c[0] + 0.16 * high - 0.1 * shadow), clamp(c[1] + 0.03 * high + 0.04 * shadow), clamp(c[2] - 0.14 * high + 0.16 * shadow)];
    },
  },
  { id: 'warm-film', label: 'Filme quente', fn: (c) => [clamp(smooth(c[0]) * 1.05 + 0.02), clamp(smooth(c[1])), clamp(smooth(c[2]) * 0.9)] },
  { id: 'cool-night', label: 'Noite fria', fn: (c) => [clamp(c[0] * 0.85), clamp(c[1] * 0.95), clamp(c[2] * 1.1 + 0.03)] },
  {
    id: 'bleach',
    label: 'Bleach bypass',
    fn: (c) => {
      const y = luma(c);
      return [clamp(y * 0.5 + c[0] * 0.5 + (y - 0.5) * 0.25), clamp(y * 0.5 + c[1] * 0.5 + (y - 0.5) * 0.25), clamp(y * 0.5 + c[2] * 0.5 + (y - 0.5) * 0.25)];
    },
  },
  { id: 'noir', label: 'Preto e branco contrastado', fn: (c) => { const y = smooth(clamp(luma(c))); return [y, y, y]; } },
  { id: 'fade', label: 'Desbotado', fn: (c) => [clamp(c[0] * 0.8 + 0.12), clamp(c[1] * 0.8 + 0.12), clamp(c[2] * 0.8 + 0.14)] },
];

const builtinCache = new Map<string, Lut3D>();

export function builtinLut(id: string): Lut3D | undefined {
  const cached = builtinCache.get(id);
  if (cached) return cached;
  const def = BUILTIN_LUTS.find((l) => l.id === id);
  if (!def) return undefined;
  const lut = identityLut(17);
  for (let i = 0; i < lut.data.length; i += 3) {
    const out = def.fn([lut.data[i]!, lut.data[i + 1]!, lut.data[i + 2]!]);
    lut.data[i] = out[0];
    lut.data[i + 1] = out[1];
    lut.data[i + 2] = out[2];
  }
  lut.title = def.label;
  builtinCache.set(id, lut);
  return lut;
}

export const BUILTIN_PREFIX = 'builtin:';

const parsedCache = new Map<string, Lut3D>();

/** Resolve a referência de um efeito de LUT: `builtin:<id>` ou uma LUT importada no projeto. */
export function resolveLut(luts: Record<string, { data: string }> | undefined, ref: string | undefined): Lut3D | undefined {
  if (!ref) return undefined;
  if (ref.startsWith(BUILTIN_PREFIX)) return builtinLut(ref.slice(BUILTIN_PREFIX.length));
  const item = luts?.[ref];
  if (!item) return undefined;
  const key = `${ref}:${item.data.length}`;
  let parsed = parsedCache.get(key);
  if (!parsed) {
    try {
      parsed = parseCube(item.data);
    } catch {
      return undefined;
    }
    if (parsedCache.size > 20) parsedCache.clear();
    parsedCache.set(key, parsed);
  }
  return parsed;
}
