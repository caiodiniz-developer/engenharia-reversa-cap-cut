import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@editor/core';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
type Rgb = [number, number, number];

function block(selector: string): string {
  const start = css.indexOf(selector + ' {');
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
}
const triple = (body: string, name: string): Rgb => {
  const m = new RegExp('--' + name + ':\\s*(\\d+) (\\d+) (\\d+);').exec(body);
  return [Number(m![1]), Number(m![2]), Number(m![3])];
};
/** "rgb(r g b / a)" de um token --glass-*. */
const rgba = (body: string, name: string): { c: Rgb; a: number } => {
  const m = new RegExp('--' + name + ':\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\)').exec(body);
  return { c: [Number(m![1]), Number(m![2]), Number(m![3])], a: Number(m![4]) };
};
const over = (top: { c: Rgb; a: number }, bottom: Rgb): Rgb => top.c.map((v, i) => Math.round(v * top.a + bottom[i]! * (1 - top.a))) as Rgb;
const hex = (c: Rgb) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');

for (const [name, selector] of [['escuro', ':root'], ['claro', ":root[data-theme='light']"]] as const) {
  describe('vidro no tema ' + name, () => {
    const body = block(selector);
    const dark = block(':root');
    const bg = triple(body.includes('--bg:') ? body : dark, 'bg');
    const accent = triple(body.includes('--accent:') ? body : dark, 'accent');
    const ink = triple(body.includes('--ink:') ? body : dark, 'ink');
    const mute = triple(body.includes('--mute:') ? body : dark, 'mute');
    // Pior caso do fundo: o ambiente soma até 14% da cor de destaque sobre o fundo.
    const lit = over({ c: accent, a: 0.14 }, bg);

    for (const token of ['glass-bg', 'glass-bg-hover', 'glass-bg-strong']) {
      it(token + ': texto principal ≥ 7:1 e texto secundário ≥ 4,5:1 sobre o fundo e sobre o fundo iluminado', () => {
        const g = rgba(body, token);
        for (const base of [bg, lit]) {
          const surface = hex(over(g, base));
          expect(contrastRatio(hex(ink), surface)!, token + ' ink').toBeGreaterThanOrEqual(7);
          expect(contrastRatio(hex(mute), surface)!, token + ' mute').toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
}
