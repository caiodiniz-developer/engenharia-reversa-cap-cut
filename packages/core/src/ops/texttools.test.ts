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
