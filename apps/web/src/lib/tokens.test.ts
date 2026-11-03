import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@editor/core';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** Lê os tokens "--nome: r g b;" de um bloco do CSS (por exemplo :root ou :root[data-theme='light']). */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {');
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(\d+) (\d+) (\d+);/g)) {
    out[m[1]!] = '#' + [m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
  return out;
}

const themes = { escuro: { ...tokens(':root') }, claro: { ...tokens(":root[data-theme='light']") } } as const;

describe('contraste das cores da interface (WCAG AA, 4,5:1 para texto)', () => {
  for (const [name, t] of Object.entries(themes)) {
    describe('tema ' + name, () => {
      it('lê os tokens do CSS', () => {
        for (const k of ['bg', 'panel', 'panel-2', 'panel-3', 'ink', 'mute', 'accent', 'accent-ink', 'danger', 'ok']) expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/);
      });

      it('texto principal e texto secundário sobre fundo e painéis', () => {
        for (const bg of ['bg', 'panel', 'panel-2', 'panel-3']) {
          expect(contrastRatio(t.ink!, t[bg]!)!, 'ink sobre ' + bg).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(t.mute!, t[bg]!)!, 'mute sobre ' + bg).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('cor de destaque como texto e o texto sobre o botão de destaque', () => {
        expect(contrastRatio(t.accent!, t.panel!)!, 'accent como texto no painel').toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t['accent-ink']!, t.accent!)!, 'texto do botão primário').toBeGreaterThanOrEqual(4.5);
      });

      it('cores de estado legíveis como texto no painel (erro e sucesso)', () => {
        expect(contrastRatio(t.danger!, t.panel!)!, 'danger').toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.ok!, t.panel!)!, 'ok').toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
