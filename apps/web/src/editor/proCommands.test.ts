import { beforeEach, describe, expect, it } from 'vitest';
import { addTitleCard, createProject, findClip, projectDuration, updateClip, type CaptionClip, type MediaClip, type TextClip } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from '../store/editor';
import { useToasts } from '../store/toasts';
import { buildCommands } from './commands';
import { buildProCommands } from './proCommands';

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
const list = buildProCommands();
const byId = (id: string) => list.find((c) => c.id === id)!;
const clips = () => s().project.tracks.flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
const toasts = () => useToasts.getState().toasts.map((t) => t.message).join(' | ');

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'Pro', revision: 1, data: createProject('Pro', { fps: 30 }) }, [item('a'), item('b')]);
});

describe('comandos de edição profissional', () => {
  it('ids únicos em toda a paleta e nenhum lança erro sem seleção', () => {
    const all = buildCommands({ openPanel: () => {}, onExport: () => {}, onHelp: () => {}, goHome: () => {} });
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(list.length).toBeGreaterThanOrEqual(25);
    for (const c of list) {
      if (c.enabled && !c.enabled()) continue;
      expect(() => c.run(), c.id).not.toThrow();
    }
  });

  it('encerramento suave põe keyframes de opacidade e fade de áudio no que termina com o projeto', () => {
    s().addToTimeline('a');
    byId('project-fade-out-1').run();
    const c = clips()[0] as MediaClip;
    expect(c.keyframes.opacity?.length).toBeGreaterThan(1);
    expect(c.audio.fadeOut).toBe(1);
    expect(toasts()).toContain('1 clipe suavizado');
    byId('project-fade-in-2').run();
    expect((clips()[0] as MediaClip).audio.fadeIn).toBe(2);
  });

  it('segurar o último quadro cria o clipe parado e o seleciona', () => {
    s().addToTimeline('a');
    s().setSelectionDuration(4);
    byId('hold-last-2').run();
    expect(clips()).toHaveLength(2);
    const hold = clips()[1] as MediaClip;
    expect(hold).toMatchObject({ freeze: true, start: 4, duration: 2 });
    expect(s().selection).toEqual([hold.id]);
    expect(projectDuration(s().project)).toBe(6);
  });

  it('igualar volume e igualar duração usam a ordem e o conteúdo da seleção', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    const [first, second] = clips();
    s().select([first!.id]);
    s().nudgeVolume(-0.4);
    s().select([first!.id, second!.id]);
    byId('match-volume').run();
    expect((findClip(s().project, second!.id)!.clip as MediaClip).audio.volume).toBeCloseTo(0.6, 5);
    s().select([first!.id]);
    s().setSelectionDuration(3);
    s().select([first!.id, second!.id]);
    byId('match-duration-shortest').run();
    expect(clips().map((c) => c.duration)).toEqual([3, 3]);
  });

  it('J-cut e L-cut mexem no áudio ligado e deixam a imagem como estava', () => {
    s().addToTimeline('a');
    s().setSelectionDuration(3); // com sourceIn 1,5 o clipe inteiro de 10 s passaria do fim da mídia
    const id = clips()[0]!.id;
    s().run('preparar', (p) => updateClip(p, id, { start: 2, sourceIn: 1.5 }));
    s().extractAudioOf(id);
    s().select([id]);
    byId('jcut-1').run();
    const audio = clips().find((c) => c.id !== id) as MediaClip;
    expect(audio.start).toBe(1);
    expect((findClip(s().project, id)!.clip as MediaClip).start).toBe(2);
    byId('lcut-0.5').run();
    const after = clips().find((c) => c.id !== id) as MediaClip;
    expect(after.start + after.duration).toBeCloseTo(2 + (findClip(s().project, id)!.clip as MediaClip).duration + 0.5, 5);
  });

  it('texto em linhas, texto → legenda → texto e marcadores nas legendas', () => {
    s().addToTimeline('a');
    let titleId = '';
    s().run('título', (p) => {
      const r = addTitleCard(p, 'Um\nDois\nTrês', 0, 6);
      titleId = r.clipId;
      return r.project;
    });
    s().select([titleId]);
    byId('split-text-lines').run();
    const texts = clips().filter((c) => c.type === 'text') as TextClip[];
    expect(texts.map((t) => t.text)).toEqual(['Um', 'Dois', 'Três']);
    expect(s().selection).toHaveLength(3);
    byId('text-to-captions').run();
    expect(clips().filter((c) => c.type === 'caption')).toHaveLength(3);
    expect(clips().some((c) => c.type === 'text')).toBe(false);
    byId('markers-captions').run();
    expect(s().project.markers.map((m) => m.label)).toEqual(['Um', 'Dois', 'Três']);
    s().select(clips().filter((c) => c.type === 'caption').map((c) => c.id));
    byId('captions-to-text').run();
    expect(clips().filter((c) => c.type === 'text')).toHaveLength(3);
    expect((clips().find((c) => c.type === 'caption') as CaptionClip | undefined)).toBeUndefined();
  });

  it('mover para a faixa de cima cria a faixa e remover faixas vazias limpa a antiga', () => {
    s().addToTimeline('a');
    byId('send-track-up').run();
    expect(s().project.tracks).toHaveLength(2);
    expect(s().project.tracks[0]!.clips).toHaveLength(1);
    byId('remove-empty-tracks').run();
    expect(s().project.tracks).toHaveLength(1);
    expect(toasts()).toContain('1 faixa removida');
    byId('remove-empty-tracks').run();
    expect(toasts()).toContain('Não há faixas vazias');
  });

  it('escalonar entrada e selecionar por trecho', () => {
    s().addToTimeline('a');
    s().addToTimeline('b', { overlay: true, at: 0 });
    s().select(clips().map((c) => c.id));
    byId('stagger-0.5').run();
    expect(clips().map((c) => c.start)).toEqual([0, 0.5]);
    s().select([]);
    byId('select-in-range').run();
    expect(toasts()).toContain('Marque o trecho com I e O');
    s().setPlayhead(0);
    s().markWorkArea('start');
    s().setPlayhead(20);
    s().markWorkArea('end');
    byId('select-in-range').run();
    expect(s().selection).toHaveLength(2);
    byId('select-touching-range').run();
    expect(toasts()).toContain('2 clipes selecionados');
  });
});
