import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, findClip, projectDuration, type MediaClip } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from '../store/editor';
import { useToasts } from '../store/toasts';
import { buildCommands } from './commands';
import { buildExtraCommands } from './extraCommands';

const item = (id: string, duration = 10, extra: Partial<MediaItem> = {}): MediaItem => ({
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
  ...extra,
});

const s = () => useEditor.getState();
const extra = buildExtraCommands();
const byId = (id: string) => extra.find((c) => c.id === id)!;
const clips = () => s().project.tracks.flatMap((t) => t.clips);
const toastTexts = () => useToasts.getState().toasts.map((t) => t.message);

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'Meu filme', revision: 1, data: createProject('Meu filme', { fps: 30 }) }, [item('a'), item('b'), item('mus', 20, { kind: 'audio', width: 0, height: 0 })]);
});

describe('comandos extras da paleta', () => {
  it('têm ids únicos (inclusive em relação aos comandos originais) e rótulos descritivos', () => {
    const all = buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} });
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(extra.length).toBeGreaterThan(100);
    expect(extra.every((c) => c.label.length > 8 && c.group)).toBe(true);
  });

  it('o estado "habilitado" acompanha a seleção', () => {
    expect(byId('align-start').enabled!()).toBe(false);
    expect(byId('distribute').enabled!()).toBe(false);
    s().addToTimeline('a');
    s().addToTimeline('b');
    s().select(clips().map((c) => c.id));
    expect(byId('align-start').enabled!()).toBe(true);
    expect(byId('swap-clips').enabled!()).toBe(true);
    expect(byId('distribute').enabled!()).toBe(false); // pede 3 ou mais
    expect(byId('split-parts-3').enabled!()).toBe(false); // pede exatamente um
  });

  it('nenhum comando extra lança erro com o projeto vazio e nada selecionado', () => {
    for (const c of extra) {
      if (c.enabled && !c.enabled()) continue;
      expect(() => c.run(), c.id).not.toThrow();
    }
  });

  it('espaçar encosta e depois afasta os clipes, e desfazer volta ao estado anterior', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    s().select(clips().map((c) => c.id));
    byId('space-1').run();
    expect(clips().map((c) => c.start)).toEqual([0, 11]);
    byId('space-0').run();
    expect(clips().map((c) => c.start)).toEqual([0, 10]);
    s().undo();
    expect(clips().map((c) => c.start)).toEqual([0, 11]);
  });

  it('dividir em partes seleciona os pedaços novos', () => {
    s().addToTimeline('a');
    byId('split-parts-4').run();
    expect(clips()).toHaveLength(4);
    expect(s().selection).toHaveLength(4);
    expect(clips().map((c) => c.duration)).toEqual([2.5, 2.5, 2.5, 2.5]);
  });

  it('título entra na cabeça de reprodução, em faixa de texto nova, e fica selecionado', () => {
    s().addToTimeline('a');
    s().setPlayhead(4);
    byId('add-title').run();
    const title = clips().find((c) => c.type === 'text')!;
    expect(title).toMatchObject({ start: 4, duration: 3, text: 'Título' });
    expect(s().selection).toEqual([title.id]);
  });

  it('marca d’água usa o nome do projeto e cobre o vídeo todo', () => {
    s().addToTimeline('a');
    byId('watermark-br').run();
    const mark = clips().find((c) => c.type === 'text')!;
    expect(mark).toMatchObject({ text: 'Meu filme', start: 0, duration: 10 });
  });

  it('comando que não muda nada avisa e não cria entrada no histórico', () => {
    s().addToTimeline('a');
    const before = s().project;
    byId('snap-grid').run(); // já está na grade
    expect(s().project).toBe(before);
    expect(toastTexts().some((m) => m.includes('já estão na grade'))).toBe(true);
    byId('remove-duplicates').run();
    expect(s().project).toBe(before);
  });

  it('marcadores periódicos respeitam a duração do projeto', () => {
    s().addToTimeline('a');
    s().addToTimeline('b'); // 20 s
    byId('markers-every-5').run();
    expect(s().project.markers.map((m) => m.time)).toEqual([5, 10, 15]);
    byId('markers-every-5').run(); // repetir não duplica
    expect(s().project.markers).toHaveLength(3);
    expect(toastTexts().some((m) => m.includes('Nenhum marcador novo'))).toBe(true);
  });

  it('remover o trecho marcado fecha o vazio e limpa a marcação', () => {
    s().addToTimeline('a'); // 10 s
    s().markWorkArea('start'); // 0
    s().setPlayhead(4);
    s().markWorkArea('end');
    expect(s().workArea).toEqual({ start: 0, end: 4 });
    byId('cut-range').run();
    expect(projectDuration(s().project)).toBe(6);
    expect(s().workArea).toBeNull();
  });

  it('opacidade e ampliação alteram só o que foi escolhido', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    const [first, second] = clips();
    s().select([first!.id]);
    byId('opacity-50').run();
    byId('scale-up').run();
    const a = findClip(s().project, first!.id)!.clip as MediaClip;
    const b = findClip(s().project, second!.id)!.clip as MediaClip;
    expect(a.transform).toMatchObject({ opacity: 0.5, scale: 1.1 });
    expect(b.transform).toMatchObject({ opacity: 1, scale: 1 });
  });

  it('abaixar a música avisa quando não há outros clipes com som', () => {
    s().addToTimeline('mus');
    s().select([clips()[0]!.id]);
    byId('duck').run();
    expect(toastTexts().some((m) => m.includes('Não há outros clipes com som'))).toBe(true);
  });

  it('abaixar a música cria keyframes de volume quando há voz ao mesmo tempo', () => {
    s().addToTimeline('mus');
    const music = clips()[0]!.id;
    s().addTrack('video');
    s().addToTimeline('a');
    s().select([music]);
    byId('duck').run();
    const m = findClip(s().project, music)!.clip as MediaClip;
    expect((m.keyframes.volume ?? []).length).toBeGreaterThan(1);
  });
});
