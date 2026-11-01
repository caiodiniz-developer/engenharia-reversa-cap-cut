import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import type { CaptionClip, Project, TextClip } from '../schema';
import { TextClipSchema } from '../schema';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addTrack } from './tracks';
import * as ops from './texttools';

let seq = 0;
function withTexts(...texts: Array<[string, number, number]>) {
  const { project } = fixtureProject();
  const t = addTrack(project, 'text');
  let p: Project = t.project;
  const ids: string[] = [];
  for (const [text, start, duration] of texts) {
    const c = TextClipSchema.parse({ id: 'tx' + ++seq, type: 'text', text, start, duration });
    p = addClip(p, t.track.id, c);
    ids.push(c.id);
  }
  return { p, ids, trackId: t.track.id };
}
const textOf = (p: Project, id: string) => findClip(p, id)!.clip as TextClip;

describe('setTextStyle', () => {
  it('muda só o informado, em texto e legenda', () => {
    const { p, ids } = withTexts(['A', 0, 1], ['B', 2, 1]);
    const out = ops.setTextStyle(p, ids, { color: '#ff0000', fontSize: 100 });
    for (const id of ids) expect(textOf(out, id).style).toMatchObject({ color: '#ff0000', fontSize: 100, bold: true });
  });

  it('recusa tamanho fora do intervalo e seleção sem texto', () => {
    const { p, ids } = withTexts(['A', 0, 1]);
    expect(() => ops.setTextStyle(p, ids, { fontSize: 5000 })).toThrow(/inválido/);
    expect(() => ops.setTextStyle(p, [], { color: '#fff' })).toThrow(/Selecione/);
  });
});

describe('placeText', () => {
  it('topo é negativo, base é positivo e meio é zero', () => {
    const { p, ids } = withTexts(['A', 0, 1]);
    expect(textOf(ops.placeText(p, ids, 'top'), ids[0]!).transform).toMatchObject({ x: 0, y: -0.38 });
    expect(textOf(ops.placeText(p, ids, 'bottom'), ids[0]!).transform.y).toBe(0.38);
    expect(textOf(ops.placeText(ops.placeText(p, ids, 'bottom'), ids, 'middle'), ids[0]!).transform.y).toBe(0);
  });
});

describe('numberTexts', () => {
  it('numera pela ordem do tempo, não pela ordem da seleção', () => {
    const { p, ids } = withTexts(['x', 4, 1], ['y', 0, 1], ['z', 2, 1]);
    const out = ops.numberTexts(p, ids, 'Cena {n}');
    expect([ids[1]!, ids[2]!, ids[0]!].map((id) => textOf(out, id).text)).toEqual(['Cena 1', 'Cena 2', 'Cena 3']);
  });

  it('aceita número inicial e repete {n}; sem {n} falha', () => {
    const { p, ids } = withTexts(['x', 0, 1], ['y', 2, 1]);
    const out = ops.numberTexts(p, ids, '{n}/{n}', 10);
    expect(textOf(out, ids[0]!).text).toBe('10/10');
    expect(textOf(out, ids[1]!).text).toBe('11/11');
    expect(() => ops.numberTexts(p, ids, 'Cena')).toThrow(/\{n\}/);
  });
});

describe('cleanText', () => {
  it('cleanString arruma espaços e linhas', () => {
    expect(ops.cleanString('  olá    mundo \t !  ')).toBe('olá mundo !');
    expect(ops.cleanString('a \n\n\n\n b')).toBe('a\n\nb');
    expect(ops.cleanString('a\r\nb')).toBe('a\nb');
  });

  it('só conta os clipes que mudaram e respeita faixa bloqueada', () => {
    const { p, ids, trackId } = withTexts(['  sujo   ', 0, 1], ['limpo', 2, 1]);
    const r = ops.cleanText(p, undefined);
    expect(r.changed).toBe(1);
    expect(textOf(r.project, ids[0]!).text).toBe('sujo');
    const locked = { ...p, tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, locked: true } : t)) };
    expect(ops.cleanText(locked).changed).toBe(0);
  });
});
