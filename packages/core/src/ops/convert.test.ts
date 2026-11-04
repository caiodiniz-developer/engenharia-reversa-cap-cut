import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { CaptionClip, Project, TextClip } from '../schema';
import { CaptionClipSchema, TextClipSchema } from '../schema';
import { addClip, fixtureProject } from '../testing';
import { addTrack } from './tracks';
import * as ops from './convert';

function withText(text: string, start = 2, duration = 6) {
  const { project } = fixtureProject();
  const t = addTrack(project, 'text');
  const clip = TextClipSchema.parse({ id: 'tx1', type: 'text', text, start, duration, style: { color: '#ff0000', fontSize: 90 } });
  return { p: addClip(t.project, t.track.id, clip), trackId: t.track.id };
}
const all = (p: Project) => p.tracks.flatMap((t) => t.clips).sort((a, b) => a.start - b.start);

describe('splitTextLines', () => {
  it('cada linha ganha uma fatia igual do tempo, em sequência, com o mesmo estilo', () => {
    const { p } = withText('A\nB\nC');
    const r = ops.splitTextLines(p, 'tx1');
    const clips = r.ids.map((id) => findClip(r.project, id)!.clip as TextClip);
    expect(clips.map((c) => [c.text, c.start, c.duration])).toEqual([['A', 2, 2], ['B', 4, 2], ['C', 6, 2]]);
    expect(r.ids[0]).toBe('tx1');
    expect(clips.every((c) => c.style.color === '#ff0000' && c.style.fontSize === 90)).toBe(true);
  });

  it('linhas em branco e espaços nas pontas são ignorados', () => {
    const { p } = withText('  A  \n\n  \nB\r\nC ');
    expect(ops.splitTextLines(p, 'tx1').ids).toHaveLength(3);
  });

  it('recusa uma linha só, duração curta demais para as linhas e clipe que não é texto', () => {
    expect(() => ops.splitTextLines(withText('só uma linha').p, 'tx1')).toThrow(/duas linhas/);
    expect(() => ops.splitTextLines(withText('A\nB\nC', 0, 0.05).p, 'tx1')).toThrow(/Linhas demais/);
    const cap = CaptionClipSchema.parse({ id: 'c1', type: 'caption', text: 'x', start: 0, duration: 2 });
    const { project } = fixtureProject();
    const t = addTrack(project, 'caption');
    expect(() => ops.splitTextLines(addClip(t.project, t.track.id, cap), 'c1')).toThrow(/texto/);
  });
});

describe('textToCaptions / captionsToText', () => {
  it('texto vira legenda no mesmo tempo, com as palavras repartidas, numa faixa de legendas nova', () => {
    const { p } = withText('olá meu mundo', 1, 3);
    const r = ops.textToCaptions(p, ['tx1']);
    expect(all(r.project).some((c) => c.type === 'text')).toBe(false);
    const cap = findClip(r.project, r.ids[0]!)!.clip as CaptionClip;
    expect(cap).toMatchObject({ text: 'olá meu mundo', start: 1, duration: 3 });
    expect(cap.words.map((w) => w.text)).toEqual(['olá', 'meu', 'mundo']);
    expect(r.project.tracks.filter((t) => t.kind === 'caption')).toHaveLength(1);
  });

  it('textos simultâneos vão para faixas de legenda diferentes', () => {
    const { project } = fixtureProject();
    const t = addTrack(project, 'text');
    const t2 = addTrack(t.project, 'text');
    let p = addClip(t2.project, t.track.id, TextClipSchema.parse({ id: 'a', type: 'text', text: 'um', start: 0, duration: 2 }));
    p = addClip(p, t2.track.id, TextClipSchema.parse({ id: 'b', type: 'text', text: 'dois', start: 1, duration: 2 }));
    expect(ops.textToCaptions(p, ['a', 'b']).project.tracks.filter((x) => x.kind === 'caption')).toHaveLength(2);
  });

  it('legenda vira texto mantendo tempo, texto e estilo; ida e volta preserva o essencial', () => {
    const { project } = fixtureProject();
    const t = addTrack(project, 'caption');
    const cap = CaptionClipSchema.parse({ id: 'c1', type: 'caption', text: 'frase da legenda', start: 4, duration: 2, style: { color: '#00ff00', fontSize: 64 } });
    const p = addClip(t.project, t.track.id, cap);
    const r = ops.captionsToText(p, ['c1']);
    const text = findClip(r.project, r.ids[0]!)!.clip as TextClip;
    expect(text).toMatchObject({ type: 'text', text: 'frase da legenda', start: 4, duration: 2 });
    expect(text.style).toMatchObject({ color: '#00ff00', fontSize: 64 });
    const back = ops.textToCaptions(r.project, r.ids);
    expect(findClip(back.project, back.ids[0]!)!.clip).toMatchObject({ type: 'caption', text: 'frase da legenda', start: 4, duration: 2 });
  });

  it('recusa seleção sem o tipo certo', () => {
    const { p } = withText('x');
    expect(() => ops.captionsToText(p, ['tx1'])).toThrow(/legendas/);
    expect(() => ops.textToCaptions(p, [])).toThrow(/texto/);
  });
});
