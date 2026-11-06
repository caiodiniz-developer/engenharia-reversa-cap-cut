import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@editor/core';
import { ACCENTS } from './appearance';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const hex = (t: string) => '#' + t.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('');

function block(selector: string): string {
  const start = css.indexOf(selector + ' {');
  if (start < 0) throw new Error('bloco não encontrado: ' + selector);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}
const token = (body: string, name: string) => new RegExp('--' + name + ':\\s*(\\d+ \\d+ \\d+);').exec(body)![1]!;

const panel = { dark: token(block(':root'), 'panel'), light: token(block(":root[data-theme='light']"), 'panel') };

describe('cores de destaque', () => {
  for (const accent of ACCENTS.filter((a) => a !== 'teal')) {
    it(accent + ': escuro e claro com contraste de texto ≥ 4,5:1', () => {
      const dark = block(":root[data-accent='" + accent + "']");
      const light = block(":root[data-theme='light'][data-accent='" + accent + "']");
      expect(contrastRatio(hex(token(dark, 'accent')), hex(panel.dark))!, 'destaque no painel escuro').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex(token(dark, 'accent-ink')), hex(token(dark, 'accent')))!, 'texto do botão escuro').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex(token(light, 'accent')), hex(panel.light))!, 'destaque no painel claro').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(hex(token(light, 'accent-ink')), hex(token(light, 'accent')))!, 'texto do botão claro').toBeGreaterThanOrEqual(4.5);
    });
  }

  it('o modo sólido existe no CSS e troca os três preenchimentos de vidro', () => {
    const body = block(":root[data-glass='solid']");
    for (const t of ['glass-bg', 'glass-bg-hover', 'glass-bg-strong']) expect(body).toContain('--' + t + ':');
  });
});
