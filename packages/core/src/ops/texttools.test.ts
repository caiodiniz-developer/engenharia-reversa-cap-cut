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

describe('addTitleCard', () => {
  it('sem faixa de texto cria uma; depois reaproveita a livre', () => {
    const { project } = fixtureProject();
    const a = ops.addTitleCard(project, ' Meu vídeo ', 0, 3);
    expect(a.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(1);
    expect(textOf(a.project, a.clipId)).toMatchObject({ text: 'Meu vídeo', start: 0, duration: 3 });
    expect(textOf(a.project, a.clipId).animationIn.type).toBe('pop');
    const b = ops.addTitleCard(a.project, 'Fim', 5, 2);
    expect(b.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(1);
  });

  it('título sobreposto vai para outra faixa; texto vazio e duração zero falham', () => {
    const { project } = fixtureProject();
    const a = ops.addTitleCard(project, 'A', 0, 3);
    const b = ops.addTitleCard(a.project, 'B', 1, 3);
    expect(b.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(2);
    expect(() => ops.addTitleCard(project, '   ', 0, 1)).toThrow();
    expect(() => ops.addTitleCard(project, 'x', 0, 0)).toThrow();
  });
});

describe('addLowerThird', () => {
  it('cria nome e função agrupados, com o nome acima da função', () => {
    const { project } = fixtureProject();
    const r = ops.addLowerThird(project, 'Ana Souza', 'Diretora', 1, 4);
    const [n, f] = r.ids.map((id) => textOf(r.project, id));
    expect(n!.groupId).toBeDefined();
    expect(n!.groupId).toBe(f!.groupId);
    expect(n!.transform.y).toBeLessThan(f!.transform.y);
    expect(n!.style.fontSize).toBeGreaterThan(f!.style.fontSize);
    expect(r.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(2); // simultâneos: faixas diferentes
  });

  it('sem função cria só o nome; nome vazio falha', () => {
    const { project } = fixtureProject();
    expect(ops.addLowerThird(project, 'Ana', '  ', 0, 2).ids).toHaveLength(1);
    expect(() => ops.addLowerThird(project, '', 'x', 0, 2)).toThrow();
  });
});

describe('addCountdown', () => {
  it('3, 2, 1 em sequência na mesma faixa', () => {
    const { project } = fixtureProject();
    const r = ops.addCountdown(project, 3, 2);
    expect(r.ids.map((id) => textOf(r.project, id).text)).toEqual(['3', '2', '1']);
    expect(r.ids.map((id) => textOf(r.project, id).start)).toEqual([2, 3, 4]);
    expect(r.project.tracks.filter((t) => t.kind === 'text')).toHaveLength(1);
  });

  it('com 1,5 s por número dura 4,5 s e valores fora do intervalo falham', () => {
    const { project } = fixtureProject();
    const r = ops.addCountdown(project, 3, 0, 1.5);
    const last = textOf(r.project, r.ids[2]!);
    expect(last.start + last.duration).toBe(4.5);
    expect(() => ops.addCountdown(project, 1, 0)).toThrow();
    expect(() => ops.addCountdown(project, 11, 0)).toThrow();
    expect(() => ops.addCountdown(project, 3, 0, 0.1)).toThrow();
  });
});

describe('splitScript', () => {
  it('quebra por linha e por frase', () => {
    expect(ops.splitScript('Olá, mundo. Tudo bem? Sim!\nLinha dois')).toEqual(['Olá, mundo.', 'Tudo bem?', 'Sim!', 'Linha dois']);
  });

  it('frases longas são quebradas entre palavras sem perder nada', () => {
    const long = Array(20).fill('palavra').join(' ');
    const parts = ops.splitScript(long, 42);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((x) => x.length <= 42)).toBe(true);
    expect(parts.join(' ')).toBe(long);
  });

  it('ignora linhas vazias e espaços repetidos', () => {
    expect(ops.splitScript('\n\n  a   b  \n\n')).toEqual(['a b']);
    expect(ops.splitScript('   ')).toEqual([]);
  });
});

describe('scriptToCaptions', () => {
  const caption = (p: Project, id: string) => findClip(p, id)!.clip as CaptionClip;

  it('cobre exatamente o intervalo, sem vãos, e a fala longa dura mais', () => {
    const { project } = fixtureProject();
    const r = ops.scriptToCaptions(project, 'Fala bem mais comprida que a outra. Curta.', 2, 12);
    const [a, b] = r.ids.map((id) => caption(r.project, id));
    expect(a!.start).toBe(2);
    expect(a!.start + a!.duration).toBeCloseTo(b!.start, 6);
    expect(b!.start + b!.duration).toBeCloseTo(12, 6);
    expect(a!.duration).toBeGreaterThan(b!.duration);
    expect(r.project.tracks.filter((t) => t.kind === 'caption')).toHaveLength(1);
    expect(a!.words.length).toBeGreaterThan(3);
  });

  it('roteiro vazio, intervalo invertido e tempo curto demais falham', () => {
    const { project } = fixtureProject();
    expect(() => ops.scriptToCaptions(project, '  ', 0, 5)).toThrow();
    expect(() => ops.scriptToCaptions(project, 'a', 5, 5)).toThrow();
    expect(() => ops.scriptToCaptions(project, 'a. b. c. d.', 0, 0.5)).toThrow(/0,3 s/);
  });
});

describe('addWatermark', () => {
  function filled() {
    const { project, trackId } = fixtureProject();
    return addClip(project, trackId, mediaClip('m1', 0, 8));
  }

  it('cobre o projeto inteiro no canto escolhido', () => {
    const r = ops.addWatermark(filled(), '@canal', 'br');
    const c = textOf(r.project, r.clipId);
    expect(c).toMatchObject({ start: 0, duration: 8, text: '@canal' });
    expect(c.transform).toMatchObject({ x: 0.36, y: 0.43, opacity: 0.55 });
    expect(c.style.align).toBe('right');
    const w = ops.addWatermark(filled(), 'x', 'tl');
    const tl = textOf(w.project, w.clipId);
    expect(tl.transform.x).toBeLessThan(0);
    expect(tl.transform.y).toBeLessThan(0);
  });

  it('aceita trecho; projeto vazio e texto vazio falham', () => {
    const r = ops.addWatermark(filled(), 'x', 'bl', { start: 2, duration: 3 });
    expect(textOf(r.project, r.clipId)).toMatchObject({ start: 2, duration: 3 });
    expect(() => ops.addWatermark(fixtureProject().project, 'x', 'tl')).toThrow(/vazio/);
    expect(() => ops.addWatermark(filled(), ' ', 'tl')).toThrow();
  });
});
