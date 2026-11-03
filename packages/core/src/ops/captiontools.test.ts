import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { CaptionClip, Project } from '../schema';
import { CaptionClipSchema } from '../schema';
import { addClip, fixtureProject } from '../testing';
import { addTrack } from './tracks';
import * as ops from './captiontools';

function withCaption(text: string, start = 2, duration = 6, timed = true) {
  const { project } = fixtureProject();
  const t = addTrack(project, 'caption');
  const tokens = text.split(' ');
  const per = duration / tokens.length;
  const words = timed ? tokens.map((w, i) => ({ text: w, start: i * per, end: (i + 1) * per })) : [];
  const clip = CaptionClipSchema.parse({ id: 'cap1', type: 'caption', text, start, duration, words });
  return { p: addClip(t.project, t.track.id, clip), trackId: t.track.id };
}
const caps = (p: Project) => p.tracks.flatMap((t) => t.clips).filter((c): c is CaptionClip => c.type === 'caption').sort((a, b) => a.start - b.start);

describe('splitLongCaptions', () => {
  it('quebra entre palavras, sem perder texto, e cobre o tempo original sem vãos', () => {
    const text = 'esta é uma legenda bastante comprida que precisa ser dividida em partes';
    const { p } = withCaption(text);
    const r = ops.splitLongCaptions(p, 30);
    const out = caps(r.project);
    expect(out.length).toBeGreaterThan(2);
    expect(r.created).toBe(out.length - 1);
    expect(out.map((c) => c.text).join(' ')).toBe(text);
    expect(out.every((c) => c.text.length <= 30)).toBe(true);
    expect(out[0]!.start).toBe(2);
    for (let i = 1; i < out.length; i++) expect(out[i]!.start).toBeCloseTo(out[i - 1]!.start + out[i - 1]!.duration, 5);
    const last = out[out.length - 1]!;
    expect(last.start + last.duration).toBeCloseTo(8, 5);
    expect(out[0]!.id).toBe('cap1');
  });

  it('as palavras de cada pedaço ficam relativas ao começo dele', () => {
    const { p } = withCaption('um dois tres quatro cinco seis sete oito nove dez onze doze', 0, 12);
    const out = caps(ops.splitLongCaptions(p, 20).project);
    for (const c of out) {
      expect(c.words[0]!.start).toBeCloseTo(0, 5);
      expect(c.words.every((w) => w.end <= c.duration + 1e-6 && w.start >= 0)).toBe(true);
    }
  });

  it('sem tempos nas palavras reparte pelo tamanho; legenda curta e valores inválidos', () => {
    const { p } = withCaption('palavra '.repeat(10).trim(), 0, 10, false);
    expect(caps(ops.splitLongCaptions(p, 20).project).length).toBeGreaterThan(2);
    const short = withCaption('curta', 0, 2);
    expect(ops.splitLongCaptions(short.p, 20)).toEqual({ project: short.p, created: 0 });
    expect(() => ops.splitLongCaptions(p, 5)).toThrow(/10 a 200/);
  });
});

describe('setCaptionHighlight', () => {
  it('define e remove a cor; recusa formato inválido e seleção sem legenda', () => {
    const { p } = withCaption('olá mundo');
    const on = ops.setCaptionHighlight(p, ['cap1'], '#ffd60a');
    expect((findClip(on, 'cap1')!.clip as CaptionClip).highlightColor).toBe('#ffd60a');
    expect((findClip(ops.setCaptionHighlight(on, ['cap1'], null), 'cap1')!.clip as CaptionClip).highlightColor).toBeUndefined();
    expect(() => ops.setCaptionHighlight(p, ['cap1'], 'amarelo')).toThrow(/#RRGGBB/);
    expect(() => ops.setCaptionHighlight(p, [], '#ffffff')).toThrow(/legendas/);
  });
});
