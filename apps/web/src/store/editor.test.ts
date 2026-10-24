import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, findClip, projectDuration, type MediaClip } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from './editor';
import { useToasts } from './toasts';

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
  urls: { original: '', proxy: null, thumb: null, waveform: null },
  ...extra,
});

const s = () => useEditor.getState();

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'Teste', revision: 1, data: createProject('Teste', { fps: 30 }) }, [item('a'), item('b'), item('img', 0, { kind: 'image', hasAudio: false }), item('mus', 20, { kind: 'audio', width: 0, height: 0 })]);
});

describe('store do editor', () => {
  it('adiciona mídia à timeline em sequência na mesma faixa', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    expect(s().project.tracks).toHaveLength(1);
    expect(s().project.tracks[0]!.clips.map((c) => [c.start, c.duration])).toEqual([[0, 10], [10, 10]]);
    expect(s().saveState).toBe('dirty');
    expect(s().selection).toHaveLength(1);
  });

  it('imagens ganham 5s e áudio vai para faixa de áudio', () => {
    s().addToTimeline('img');
    s().addToTimeline('mus');
    expect(s().project.tracks.map((t) => t.kind)).toEqual(['video', 'audio']);
    expect(projectDuration(s().project)).toBe(20);
    expect(s().project.tracks[0]!.clips[0]!.duration).toBe(5);
  });

  it('divide no cursor, desfaz e refaz', () => {
    s().addToTimeline('a');
    s().setPlayhead(4);
    s().splitAtPlayhead();
    expect(s().project.tracks[0]!.clips).toHaveLength(2);
    s().undo();
    expect(s().project.tracks[0]!.clips).toHaveLength(1);
    s().redo();
    expect(s().project.tracks[0]!.clips).toHaveLength(2);
    expect(s().project.tracks[0]!.clips[1]).toMatchObject({ start: 4, sourceIn: 4, duration: 6 });
  });

  it('exclui com ripple e sem ripple', () => {
    s().addToTimeline('a');
    s().addToTimeline('b');
    const [first, second] = s().project.tracks[0]!.clips;
    s().select([first!.id]);
    s().deleteSelection(true);
    expect(findClip(s().project, second!.id)!.clip.start).toBe(0);
    expect(s().selection).toEqual([]);
  });

  it('erros da timeline viram toast e não alteram o projeto', () => {
    s().addToTimeline('a');
    const before = s().project;
    const [c] = s().project.tracks[0]!.clips;
    s().trim(c!.id, 'end', 99);
    expect(s().project).toBe(before);
    expect(useToasts.getState().toasts[0]).toMatchObject({ kind: 'error' });
    expect(useToasts.getState().toasts[0]!.message).toMatch(/mídia/);
  });

  it('arrastos contínuos viram um único passo de undo', () => {
    s().addToTimeline('a');
    const [c] = s().project.tracks[0]!.clips;
    s().select([c!.id]);
    const stepsBefore = s().history.entries.length;
    s().moveSelection([c!.id], 1, c!.id);
    s().moveSelection([c!.id], 1, c!.id);
    s().moveSelection([c!.id], 1, c!.id);
    expect(s().history.entries.length).toBe(stepsBefore + 1);
    expect(findClip(s().project, c!.id)!.clip.start).toBe(3);
    s().sealDrag();
    s().moveSelection([c!.id], 1, c!.id);
    expect(s().history.entries.length).toBe(stepsBefore + 2);
    s().undo();
    expect(findClip(s().project, c!.id)!.clip.start).toBe(3);
  });

  it('copia e cola no cursor, sem sobreposição', () => {
    s().addToTimeline('a');
    const [c] = s().project.tracks[0]!.clips;
    s().select([c!.id]);
    s().copySelection();
    s().setPlayhead(2);
    s().pasteClipboard();
    const all = s().project.tracks.flatMap((t) => t.clips);
    expect(all).toHaveLength(2);
    expect(s().project.tracks).toHaveLength(2); // a primeira faixa estava ocupada: colou em nova faixa
    expect(all.some((x) => x.start === 2)).toBe(true);
  });

  it('extrair áudio liga vídeo e áudio: selecionar um seleciona o par', () => {
    s().addToTimeline('a');
    const [v] = s().project.tracks[0]!.clips;
    s().extractAudioOf(v!.id);
    const clips = s().project.tracks.flatMap((t) => t.clips);
    expect(clips).toHaveLength(2);
    s().select([v!.id]);
    expect(s().selection).toHaveLength(2);
    s().select([v!.id], { single: true });
    expect(s().selection).toHaveLength(1);
  });

  it('keyframes: cria no cursor e remove', () => {
    s().addToTimeline('a');
    const [c] = s().project.tracks[0]!.clips;
    s().setPlayhead(1);
    s().setKeyframe(c!.id, 'x', 0.1);
    s().setPlayhead(3);
    s().setKeyframe(c!.id, 'x', 0.4);
    const kf = (findClip(s().project, c!.id)!.clip as MediaClip).keyframes.x!;
    expect(kf.map((k) => [k.time, k.value])).toEqual([[1, 0.1], [3, 0.4]]);
    s().setPlayhead(1);
    s().removeKeyframe(c!.id, 'x');
    expect((findClip(s().project, c!.id)!.clip as MediaClip).keyframes.x).toHaveLength(1);
  });

  it('efeitos: adiciona, ajusta com limites, desativa e remove', () => {
    s().addToTimeline('a');
    const [c] = s().project.tracks[0]!.clips;
    s().addEffect(c!.id, 'blur');
    const fx = () => (findClip(s().project, c!.id)!.clip as MediaClip).effects;
    s().updateEffect(c!.id, fx()[0]!.id, { sigma: 9999 });
    expect(fx()[0]!.params.sigma).toBe(40);
    s().toggleEffect(c!.id, fx()[0]!.id);
    expect(fx()[0]!.enabled).toBe(false);
    s().applyPreset(c!.id, 'cinematic');
    expect(fx().length).toBeGreaterThan(3);
    s().removeEffect(c!.id, fx()[0]!.id);
    expect(fx().some((e) => e.type === 'blur')).toBe(false);
  });

  it('texto e legendas entram em suas faixas', () => {
    s().setPlayhead(0);
    s().addText('Olá');
    s().addCaptions([{ start: 0, end: 1, text: 'um' }, { start: 1, end: 2, text: 'dois' }]);
    expect(s().project.tracks.map((t) => t.kind).sort()).toEqual(['caption', 'text']);
    expect(s().project.tracks.find((t) => t.kind === 'caption')!.clips).toHaveLength(2);
  });

  it('faixa bloqueada impede edição', () => {
    s().addToTimeline('a');
    const t = s().project.tracks[0]!;
    s().patchTrack(t.id, { locked: true });
    s().select([t.clips[0]!.id]);
    s().deleteSelection(false);
    expect(s().project.tracks[0]!.clips).toHaveLength(1);
    expect(useToasts.getState().toasts.some((x) => /bloqueada/.test(x.message))).toBe(true);
  });

  it('cursor fica dentro de [0, duração] e navega por quadros', () => {
    s().addToTimeline('a');
    s().setPlayhead(-5);
    expect(s().playhead).toBe(0);
    s().setPlayhead(999);
    expect(s().playhead).toBe(10);
    s().setPlayhead(0);
    s().stepFrames(3);
    expect(s().playhead).toBeCloseTo(0.1, 5);
  });

  it('togglePlay reinicia do começo ao chegar ao fim', () => {
    s().addToTimeline('a');
    s().setPlayhead(10);
    s().togglePlay();
    expect(s().playing).toBe(true);
    expect(s().playhead).toBe(0);
  });
});
