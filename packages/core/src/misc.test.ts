import { describe, expect, it } from 'vitest';
import { detectBeats, detectSilence, invertRanges, peaks } from './analysis';
import { captionClipsToCues, cuesToCaptionClips, parseSrt, parseVtt, toSrt, toVtt, wordsToCues } from './captions';
import { applyEffectsToPixels, clampParams, createEffect, effectsToFfmpeg, presetToEffects } from './effects';
import { canRedo, canUndo, commit, createHistory, jumpTo, present, redo, undo } from './history';
import { evaluateKeyframes, splitKeyframes, upsertKeyframe } from './keyframes';
import { migrateProject, ProjectVersionError } from './migrate';
import { createProject, parseProject } from './project';
import { collectSnapPoints, snapRange } from './snap';
import { addTrack, addMarker } from './ops/tracks';
import { formatTimecode } from './time';

describe('history', () => {
  it('undo/redo e truncamento do futuro', () => {
    let h = createHistory(0);
    h = commit(h, 1, 'a');
    h = commit(h, 2, 'b');
    expect(present(undo(h))).toBe(1);
    expect(canRedo(undo(h))).toBe(true);
    h = undo(undo(h));
    expect(present(h)).toBe(0);
    expect(canUndo(h)).toBe(false);
    h = commit(h, 9, 'c');
    expect(canRedo(h)).toBe(false);
    expect(present(redo(h))).toBe(9);
  });

  it('funde operações contínuas com a mesma chave', () => {
    let h = createHistory(0);
    h = commit(h, 1, 'mover', 'drag');
    h = commit(h, 2, 'mover', 'drag');
    h = commit(h, 3, 'mover', 'drag');
    expect(h.entries.length).toBe(2);
    expect(present(undo(h))).toBe(0);
  });

  it('jumpTo navega pelo histórico', () => {
    let h = createHistory('a');
    h = commit(h, 'b', 'x');
    h = commit(h, 'c', 'y');
    expect(present(jumpTo(h, 1))).toBe('b');
  });
});

describe('keyframes', () => {
  const kfs = [
    { time: 0, value: 0, easing: 'linear' as const },
    { time: 2, value: 10, easing: 'linear' as const },
  ];
  it('interpola linearmente e prende nas pontas', () => {
    expect(evaluateKeyframes(kfs, 1, 99)).toBe(5);
    expect(evaluateKeyframes(kfs, -1, 99)).toBe(0);
    expect(evaluateKeyframes(kfs, 5, 99)).toBe(10);
    expect(evaluateKeyframes(undefined, 1, 99)).toBe(99);
  });
  it('ease suaviza e hold mantém o valor', () => {
    const e = [{ time: 0, value: 0, easing: 'ease' as const }, { time: 2, value: 10, easing: 'linear' as const }];
    expect(evaluateKeyframes(e, 1, 0)).toBe(5);
    expect(evaluateKeyframes(e, 0.5, 0)).toBeLessThan(2.5);
    const h = [{ time: 0, value: 3, easing: 'hold' as const }, { time: 2, value: 10, easing: 'linear' as const }];
    expect(evaluateKeyframes(h, 1.9, 0)).toBe(3);
  });
  it('upsert substitui no mesmo tempo e ordena', () => {
    const r = upsertKeyframe(upsertKeyframe(undefined, 2, 1), 0, 5);
    expect(r.map((k) => k.time)).toEqual([0, 2]);
    expect(upsertKeyframe(r, 2, 7).find((k) => k.time === 2)!.value).toBe(7);
  });
  it('divide a curva preservando o valor no corte', () => {
    const s = splitKeyframes(kfs, 1, 0);
    expect(s.left!.at(-1)).toMatchObject({ time: 1, value: 5 });
    expect(s.right![0]).toMatchObject({ time: 0, value: 5 });
    expect(s.right!.at(-1)).toMatchObject({ time: 1, value: 10 });
  });
});

describe('captions', () => {
  const srt = `1\n00:00:01,000 --> 00:00:03,500\nOlá mundo\n\n2\n00:00:04,000 --> 00:00:06,000\nSegunda\nlinha\n`;
  it('parse e serialização SRT fazem round-trip', () => {
    const cues = parseSrt(srt);
    expect(cues).toEqual([
      { start: 1, end: 3.5, text: 'Olá mundo' },
      { start: 4, end: 6, text: 'Segunda\nlinha' },
    ]);
    expect(parseSrt(toSrt(cues))).toEqual(cues);
  });
  it('VTT com cabeçalho, configurações e tags', () => {
    const vtt = `WEBVTT\n\n00:01.000 --> 00:02.000 align:start\n<b>Oi</b>\n`;
    expect(parseVtt(vtt)).toEqual([{ start: 1, end: 2, text: 'Oi' }]);
    expect(parseVtt(toVtt([{ start: 61.5, end: 62, text: 'x' }]))).toEqual([{ start: 61.5, end: 62, text: 'x' }]);
  });
  it('cues <-> clipes de legenda', () => {
    const clips = cuesToCaptionClips(parseSrt(srt));
    expect(clips[0]!.words.map((w) => w.text)).toEqual(['Olá', 'mundo']);
    expect(captionClipsToCues(clips)[0]).toMatchObject({ start: 1, end: 3.5 });
  });
  it('agrupa palavras em cues respeitando limites', () => {
    const words = Array.from({ length: 12 }, (_, i) => ({ text: `palavra${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
    const cues = wordsToCues(words, { maxChars: 30 });
    expect(cues.length).toBeGreaterThan(2);
    expect(cues.every((c) => c.text.length <= 30)).toBe(true);
  });
  it('rejeita timestamp inválido', () => {
    expect(() => parseSrt('1\nabc --> def\nx')).toThrow();
  });
});

describe('effects', () => {
  const px = () => new Uint8ClampedArray([100, 150, 200, 255]);
  it('brilho e contraste', () => {
    const d = px();
    applyEffectsToPixels(d, 1, 1, [createEffect('brightness', { amount: 0.2 })]);
    expect(d[0]).toBeCloseTo(100 + 51, 0);
    const c = px();
    applyEffectsToPixels(c, 1, 1, [createEffect('contrast', { amount: 2 })]);
    expect(Math.abs(c[0]! - ((100 / 255 - 0.5) * 2 + 0.5) * 255)).toBeLessThanOrEqual(0.5);
  });
  it('saturação 0 gera cinza', () => {
    const d = px();
    applyEffectsToPixels(d, 1, 1, [createEffect('saturation', { amount: 0 })]);
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
  });
  it('chroma key zera o alfa na cor-chave', () => {
    const d = new Uint8ClampedArray([0, 255, 0, 255, 200, 20, 20, 255]);
    applyEffectsToPixels(d, 2, 1, [createEffect('chromakey', { similarity: 0.3, blend: 0 })]);
    expect(d[3]).toBe(0);
    expect(d[7]).toBe(255);
  });
  it('limita parâmetros e rejeita tipos desconhecidos', () => {
    expect(clampParams('blur', { sigma: 999, foo: 1 })).toEqual({ sigma: 40 });
    expect(() => createEffect('nao-existe')).toThrow();
  });
  it('gera filtros FFmpeg separados por grupo (opaco/alfa)', () => {
    const fx = [createEffect('chromakey'), createEffect('brightness', { amount: 0.1 }), createEffect('blur', { sigma: 3 })];
    const ctx = { width: 640, height: 360 };
    expect(effectsToFfmpeg(fx, ctx, false).join(',')).toContain('lutrgb');
    expect(effectsToFfmpeg(fx, ctx, false).join(',')).toContain('gblur=sigma=3');
    expect(effectsToFfmpeg(fx, ctx, true)).toEqual([expect.stringContaining('colorkey=color=0x00ff00')]);
  });
  it('presets produzem instâncias válidas', () => {
    expect(presetToEffects('cinematic').length).toBeGreaterThan(2);
    expect(() => presetToEffects('x')).toThrow();
  });
});

describe('project', () => {
  it('migra/valida e rejeita versão futura', () => {
    const p = createProject('x');
    expect(migrateProject(JSON.parse(JSON.stringify(p))).id).toBe(p.id);
    expect(() => migrateProject({ ...p, version: 99 })).toThrow(ProjectVersionError);
    expect(() => migrateProject(null)).toThrow(ProjectVersionError);
    expect(() => parseProject({ foo: 1 })).toThrow();
  });
  it('serializa de forma estável (round-trip JSON)', () => {
    let p = createProject('rt');
    p = addTrack(p, 'video').project;
    p = addMarker(p, 3, 'm').project;
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('faixas: vídeo acima do áudio', () => {
    let p = createProject();
    p = addTrack(p, 'audio').project;
    p = addTrack(p, 'video').project;
    p = addTrack(p, 'text').project;
    expect(p.tracks.map((t) => t.kind)).toEqual(['text', 'video', 'audio']);
  });
});

describe('snap / time / analysis', () => {
  it('encaixa borda inicial ou final no ponto mais próximo', () => {
    let p = createProject();
    p = addMarker(p, 5).project;
    const pts = collectSnapPoints(p, { playhead: 10 });
    expect(snapRange(4.9, 2, pts, 0.2).start).toBeCloseTo(5);
    expect(snapRange(7.95, 2, pts, 0.2).start).toBeCloseTo(8);
    expect(snapRange(20, 2, pts, 0.2).snappedTo).toBeUndefined();
  });
  it('timecode', () => {
    expect(formatTimecode(3661.5, 30)).toBe('01:01:01:15');
  });
  it('silêncio, picos, batidas e inversão', () => {
    const lv = [0.5, 0.5, 0, 0, 0, 0.5, 0, 0.5];
    const sil = detectSilence(lv, 0.5, { threshold: 0.02, minDuration: 1 });
    expect(sil).toEqual([{ start: 1, end: 2.5 }]);
    expect(invertRanges(sil, 4)).toEqual([{ start: 0, end: 1 }, { start: 2.5, end: 4 }]);
    expect(Array.from(peaks([0, -1, 0.5, 0.2], 2))).toEqual([1, 0.5]);
    const energy = new Array(100).fill(0.1);
    energy[30] = 1;
    energy[60] = 1;
    expect(detectBeats(energy, 0.1)).toEqual([3, 6]);
  });
});
