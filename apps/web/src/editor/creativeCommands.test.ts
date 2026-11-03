import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, findClip, projectDuration, type CaptionClip, type MediaClip } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from '../store/editor';
import { useToasts } from '../store/toasts';
import { buildCommands } from './commands';
import { buildCreativeCommands } from './creativeCommands';

const item = (id: string, duration = 10): MediaItem => ({
  id,
  name: `${id}.mp4`,
  kind: 'video',
  duration,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: true,
  size: 1,
  mime: 'video/mp4',
  status: 'ready',
  error: null,
  urls: { original: '', proxy: null, thumb: null, waveform: null, film: null },
});

const s = () => useEditor.getState();
const list = buildCreativeCommands();
const byId = (id: string) => list.find((c) => c.id === id)!;
const clips = () => s().project.tracks.flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
const toasts = () => useToasts.getState().toasts.map((t) => t.message).join(' | ');

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'Criativo', revision: 1, data: createProject('Criativo', { fps: 30 }) }, [item('a'), item('b')]);
});

describe('comandos criativos', () => {
  it('ids únicos entre todos os comandos da paleta e nenhum lança erro sem seleção', () => {
    const all = buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} });
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(list.length).toBeGreaterThanOrEqual(40);
    for (const c of list) {
      if (c.enabled && !c.enabled()) continue;
      expect(() => c.run(), c.id).not.toThrow();
    }
  });

  it('rampa de velocidade troca o clipe por 6 trechos e os seleciona; desfazer volta ao clipe', () => {
    s().addToTimeline('a');
    byId('ramp-slow-normal').run();
    expect(clips()).toHaveLength(6);
    expect(s().selection).toHaveLength(6);
    const speeds = clips().map((c) => (c as MediaClip).speed);
    expect(speeds[0]).toBeLessThan(speeds[5]!);
    expect(projectDuration(s().project)).toBeGreaterThan(10); // a parte lenta alonga o clipe
    s().undo();
    expect(clips()).toHaveLength(1);
  });

  it('boomerang acrescenta a cópia em reverso; gagueira repete o trecho na cabeça', () => {
    s().addToTimeline('a'); // 10 s; mas boomerang precisa de espaço: encurta antes
    s().setSelectionDuration(2);
    byId('boomerang').run();
    expect(clips().map((c) => [c.start, c.duration, (c as MediaClip).reverse])).toEqual([[0, 2, false], [2, 2, true]]);
    s().undo();
    s().select([clips()[0]!.id]);
    s().setPlayhead(0.5);
    byId('stutter-0.25').run();
    // antes (0,5 s) + o trecho de 0,25 s tocado 4× (original + 3 cópias) + o resto
    expect(clips()).toHaveLength(6);
    expect(projectDuration(s().project)).toBeCloseTo(2 + 0.75, 5);
  });

  it('seleção por critério seleciona os clipes certos e avisa quando não há', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    const [first] = clips();
    s().select([first!.id]);
    byId('select-invert').run();
    expect(s().selection).toEqual([clips()[1]!.id]);
    byId('select-where-reversed').run();
    expect(toasts()).toContain('Nenhum clipe invertido');
    s().select([first!.id]);
    s().setSelectionSpeed(2);
    byId('select-where-speed').run();
    expect(s().selection).toEqual([first!.id]);
  });

  it('carimbar nos marcadores cria cópias onde há marcadores livres', () => {
    s().addToTimeline('a'); // 10 s: o playhead só vai até o fim do projeto, então os marcadores vêm antes de encurtar
    s().setPlayhead(3);
    s().addMarkerAtPlayhead();
    s().setPlayhead(6);
    s().addMarkerAtPlayhead();
    s().setSelectionDuration(1);
    byId('stamp-markers').run();
    expect(clips().map((c) => c.start)).toEqual([0, 3, 6]);
    expect(s().selection).toHaveLength(2);
  });

  it('tela dividida e imagem dentro da imagem mexem só na transformação', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    s().select(clips().map((c) => c.id));
    byId('split-side').run();
    const [x, y] = clips().map((c) => (c as MediaClip).transform);
    expect(x).toMatchObject({ x: -0.25, scale: 1 });
    expect(y).toMatchObject({ x: 0.25 });
    s().select([clips()[0]!.id]);
    byId('pip-br').run();
    expect((findClip(s().project, clips()[0]!.id)!.clip as MediaClip).transform).toMatchObject({ scale: 0.3 });
  });

  it('transições em lote e ordenar a faixa passam pelo histórico', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    s().select([clips()[0]!.id]);
    byId('transitions-all-fade').run();
    expect(projectDuration(s().project)).toBeCloseTo(19.5, 5);
    byId('transitions-remove-all').run();
    expect(projectDuration(s().project)).toBe(20);
    s().setSelectionDuration(3);
    byId('sort-duration-desc').run();
    expect(clips().map((c) => c.duration)).toEqual([10, 3]);
  });

  it('legendas: aviso quando nenhuma é longa e quebra quando é', () => {
    byId('captions-split-long').run();
    expect(toasts()).toContain('Nenhuma legenda passa de 42 caracteres');
    s().addToTimeline('a');
    const r = s().scriptToCaptions('Esta é uma frase de legenda realmente comprida demais para uma única linha na tela.', 0, 6);
    expect(r).toBeGreaterThan(0);
    const before = clips().filter((c) => c.type === 'caption').length;
    byId('captions-split-long').run();
    expect(clips().filter((c) => c.type === 'caption').length).toBeGreaterThanOrEqual(before);
    s().select(clips().filter((c) => c.type === 'caption').map((c) => c.id));
    byId('caption-highlight-amarelo').run();
    expect((clips().find((c) => c.type === 'caption') as CaptionClip).highlightColor).toBe('#ffd60a');
  });
});
