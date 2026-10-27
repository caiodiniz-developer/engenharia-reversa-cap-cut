import { describe, expect, it } from 'vitest';
import { newId } from '../ids';
import { findClip } from '../project';
import { CaptionClipSchema, TextClipSchema, type CaptionClip, type TextClip } from '../schema';
import { addClip, fixtureProject } from '../testing';
import { addTrack } from './tracks';
import { applyCase, changeTextCase, replaceInText } from './textedit';

function withTexts() {
  const { project } = fixtureProject();
  const tt = addTrack(project, 'text');
  const tc = addTrack(tt.project, 'caption');
  const a = TextClipSchema.parse({ id: newId('clp'), type: 'text', start: 0, duration: 2, text: 'olá MUNDO cruel' });
  const b = TextClipSchema.parse({ id: newId('clp'), type: 'text', start: 3, duration: 2, text: 'Mundo novo, mundo velho' });
  const cap = CaptionClipSchema.parse({
    id: newId('clp'),
    type: 'caption',
    start: 0,
    duration: 2,
    text: 'bom dia mundo',
    words: [
      { text: 'bom', start: 0, end: 0.5 },
      { text: 'dia', start: 0.5, end: 1 },
      { text: 'mundo', start: 1, end: 2 },
    ],
  });
  let p = addClip(addClip(tc.project, tt.track.id, a), tt.track.id, b);
  p = addClip(p, tc.track.id, cap);
  return { p, a, b, cap };
}

describe('applyCase', () => {
  it('maiúsculas e minúsculas respeitam acentos do português', () => {
    expect(applyCase('ação é ÓTIMA', 'upper')).toBe('AÇÃO É ÓTIMA');
    expect(applyCase('AÇÃO É ÓTIMA', 'lower')).toBe('ação é ótima');
  });

  it('título: cada palavra com inicial maiúscula, inclusive depois de hífen e aspas', () => {
    expect(applyCase('o rato roeu a roupa-do-rei', 'title')).toBe('O Rato Roeu A Roupa-Do-Rei');
    expect(applyCase('"olá" mundo', 'title')).toBe('"Olá" Mundo');
  });

  it('frase: só a inicial de cada sentença', () => {
    expect(applyCase('OLÁ. COMO VAI? tudo bem! ÓTIMO', 'sentence')).toBe('Olá. Como vai? Tudo bem! Ótimo');
  });
});

describe('changeTextCase', () => {
  it('altera textos e legendas (inclusive as palavras temporizadas) e ignora clipes de mídia', () => {
    const { p, a, cap } = withTexts();
    const out = changeTextCase(p, [a.id, cap.id], 'upper');
    expect((findClip(out, a.id)!.clip as TextClip).text).toBe('OLÁ MUNDO CRUEL');
    const c = findClip(out, cap.id)!.clip as CaptionClip;
    expect(c.text).toBe('BOM DIA MUNDO');
    expect(c.words!.map((w) => w.text)).toEqual(['BOM', 'DIA', 'MUNDO']);
    expect(c.words!.map((w) => w.start)).toEqual([0, 0.5, 1]);
  });

  it('não mexe nos clipes que não foram escolhidos', () => {
    const { p, a, b } = withTexts();
    const out = changeTextCase(p, [a.id], 'lower');
    expect((findClip(out, b.id)!.clip as TextClip).text).toBe('Mundo novo, mundo velho');
  });
});

describe('replaceInText', () => {
  it('troca em todos os textos e legendas, sem diferenciar maiúsculas por padrão, e conta as ocorrências', () => {
    const { p, a, b, cap } = withTexts();
    const { project, count } = replaceInText(p, 'mundo', 'planeta');
    expect(count).toBe(4);
    expect((findClip(project, a.id)!.clip as TextClip).text).toBe('olá planeta cruel');
    expect((findClip(project, b.id)!.clip as TextClip).text).toBe('planeta novo, planeta velho');
    const c = findClip(project, cap.id)!.clip as CaptionClip;
    expect(c.text).toBe('bom dia planeta');
    expect(c.words!.map((w) => w.text)).toEqual(['bom', 'dia', 'planeta']);
  });

  it('com "diferenciar maiúsculas" só troca a grafia exata', () => {
    const { p, b } = withTexts();
    const { project, count } = replaceInText(p, 'Mundo', 'Globo', { matchCase: true });
    expect(count).toBe(1);
    expect((findClip(project, b.id)!.clip as TextClip).text).toBe('Globo novo, mundo velho');
  });

  it('a busca é literal: caracteres especiais não viram expressão regular', () => {
    const { p, a } = withTexts();
    const t = changeTextCase(p, [a.id], 'lower');
    const { project: p2 } = replaceInText(t, 'olá', 'a.b (x)');
    const { project, count } = replaceInText(p2, 'a.b (x)', '$&');
    expect(count).toBe(1);
    expect((findClip(project, a.id)!.clip as TextClip).text).toBe('$& mundo cruel');
  });

  it('limita aos ids informados e devolve zero quando não acha', () => {
    const { p, a, b } = withTexts();
    const { project, count } = replaceInText(p, 'mundo', 'X', { ids: [a.id] });
    expect(count).toBe(1);
    expect((findClip(project, b.id)!.clip as TextClip).text).toBe('Mundo novo, mundo velho');
    expect(replaceInText(p, 'inexistente', 'X').count).toBe(0);
    expect(replaceInText(p, '', 'X').count).toBe(0);
  });

  it('trocar uma palavra por duas descarta o tempo por palavra da legenda (fica só o texto inteiro)', () => {
    const { p, cap } = withTexts();
    const { project } = replaceInText(p, 'dia', 'bom dia');
    const c = findClip(project, cap.id)!.clip as CaptionClip;
    expect(c.text).toBe('bom bom dia mundo');
    expect(c.words).toEqual([]);
  });
});
