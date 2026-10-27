import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { findClip } from '../project';
import { CaptionClipSchema, type CaptionClip } from '../schema';
import { addClip, fixtureProject } from '../testing';
import { fastCaptionIds, mergeCaptions, readingSpeed, shiftCaptions } from './captions';
import { addTrack } from './tracks';

function setup(specs: Array<{ start: number; duration: number; text: string; words?: Array<[string, number, number]> }>) {
  const { project } = fixtureProject();
  const tc = addTrack(project, 'caption');
  let p = tc.project;
  const clips: CaptionClip[] = specs.map((s) =>
    CaptionClipSchema.parse({ id: newId('clp'), type: 'caption', start: s.start, duration: s.duration, text: s.text, words: (s.words ?? []).map(([text, start, end]) => ({ text, start, end })) }),
  );
  for (const c of clips) p = addClip(p, tc.track.id, c);
  return { p, clips, trackId: tc.track.id };
}

describe('readingSpeed / fastCaptionIds', () => {
  it('caracteres por segundo; quebras de linha não contam como caractere', () => {
    expect(readingSpeed('abcdefghij', 2)).toBe(5);
    expect(readingSpeed('abcde\nfghij', 2)).toBe(5.5); // a quebra vira um espaço: 11 caracteres
    expect(readingSpeed('x', 0)).toBe(Infinity);
  });

  it('aponta só as legendas acima do limite (padrão 20 cps)', () => {
    const { p, clips } = setup([
      { start: 0, duration: 1, text: 'Texto muito longo para um segundo só, impossível ler' },
      { start: 2, duration: 4, text: 'Fácil de ler' },
    ]);
    expect(fastCaptionIds(p)).toEqual([clips[0]!.id]);
    expect(fastCaptionIds(p, 100)).toEqual([]);
  });
});

describe('shiftCaptions', () => {
  it('desloca todas as legendas e mantém as durações', () => {
    const { p, clips } = setup([
      { start: 1, duration: 1, text: 'a' },
      { start: 3, duration: 2, text: 'b' },
    ]);
    const out = shiftCaptions(p, 0.5);
    expect(findClip(out, clips[0]!.id)!.clip).toMatchObject({ start: 1.5, duration: 1 });
    expect(findClip(out, clips[1]!.id)!.clip).toMatchObject({ start: 3.5, duration: 2 });
  });

  it('para no zero ao adiantar demais e não faz nada com delta 0', () => {
    const { p, clips } = setup([{ start: 0.3, duration: 1, text: 'a' }, { start: 2, duration: 1, text: 'b' }]);
    const out = shiftCaptions(p, -5);
    expect(findClip(out, clips[0]!.id)!.clip.start).toBe(0);
    expect(findClip(out, clips[1]!.id)!.clip.start).toBeCloseTo(1.7, 6); // o grupo anda junto: a primeira bate no zero
    expect(shiftCaptions(p, 0)).toBe(p);
  });
});

describe('mergeCaptions', () => {
  it('une textos, cobre do início da primeira ao fim da última e reposiciona as palavras', () => {
    const { p, clips } = setup([
      { start: 2, duration: 1, text: 'Olá', words: [['Olá', 0, 1]] },
      { start: 3, duration: 2, text: 'mundo cruel', words: [['mundo', 0, 1], ['cruel', 1, 2]] },
    ]);
    const { project, mergedId } = mergeCaptions(p, [clips[1]!.id, clips[0]!.id]);
    const m = findClip(project, mergedId)!.clip as CaptionClip;
    expect(mergedId).toBe(clips[0]!.id);
    expect(m).toMatchObject({ start: 2, duration: 3, text: 'Olá mundo cruel' });
    expect(m.words.map((w) => [w.text, w.start, w.end])).toEqual([['Olá', 0, 1], ['mundo', 1, 2], ['cruel', 2, 3]]);
    expect(project.tracks.find((t) => t.kind === 'caption')!.clips).toHaveLength(1);
  });

  it('se alguma legenda não tem tempo por palavra, descarta o tempo por palavra de todas', () => {
    const { p, clips } = setup([
      { start: 0, duration: 1, text: 'a', words: [['a', 0, 1]] },
      { start: 1, duration: 1, text: 'b' },
    ]);
    const m = findClip(mergeCaptions(p, clips.map((c) => c.id)).project, clips[0]!.id)!.clip as CaptionClip;
    expect(m.words).toEqual([]);
    expect(m.text).toBe('a b');
  });

  it('recusa menos de duas legendas, clipes de outro tipo e legendas com outro clipe no meio', () => {
    const { p, clips, trackId } = setup([
      { start: 0, duration: 1, text: 'a' },
      { start: 5, duration: 1, text: 'c' },
    ]);
    expect(() => mergeCaptions(p, [clips[0]!.id])).toThrow();
    const meio = CaptionClipSchema.parse({ id: newId('clp'), type: 'caption', start: 2, duration: 1, text: 'meio' });
    const withMiddle = addClip(p, trackId, meio);
    expect(() => mergeCaptions(withMiddle, [clips[0]!.id, clips[1]!.id])).toThrow(/entre/);
    // juntar as três funciona
    expect(mergeCaptions(withMiddle, [clips[0]!.id, meio.id, clips[1]!.id]).project.tracks.find((t) => t.kind === 'caption')!.clips).toHaveLength(1);
  });
});
