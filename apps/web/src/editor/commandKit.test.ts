import { beforeEach, describe, expect, it } from 'vitest';
import { TimelineError, createProject, renameProject, type Project } from '@editor/core';
import type { MediaItem } from '../api/types';
import { useEditor } from '../store/editor';
import { useToasts } from '../store/toasts';
import { applyCounted, focusTrackId, onSelection } from './commandKit';

const item = (id: string): MediaItem => ({
  id,
  name: id + '.mp4',
  kind: 'video',
  duration: 10,
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
const toasts = () => useToasts.getState().toasts;

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'Kit', revision: 1, data: createProject('Kit', { fps: 30 }) }, [item('a')]);
});

describe('applyCounted', () => {
  it('quando nada mudou avisa e não toca no projeto nem no histórico', () => {
    const before = s().project;
    const idx = s().history.index;
    applyCounted('x', (p) => ({ project: p, n: 0 }), (r) => r.n, 'Nada para fazer', () => 'feito');
    expect(s().project).toBe(before);
    expect(s().history.index).toBe(idx);
    expect(toasts()[0]).toMatchObject({ kind: 'info', message: 'Nada para fazer' });
  });

  it('quando mudou registra a edição e o aviso traz Desfazer, que desfaz de verdade', () => {
    applyCounted('Renomear', (p) => ({ project: renameProject(p, 'Novo nome'), n: 2 }), (r) => r.n, 'nada', (n) => n + ' alterações');
    expect(s().project.name).toBe('Novo nome');
    const t = toasts()[0]!;
    expect(t).toMatchObject({ kind: 'success', message: '2 alterações' });
    expect(t.action?.label).toBe('Desfazer');
    t.action!.run();
    expect(s().project.name).toBe('Kit');
  });

  it('erro de timeline vira aviso de erro sem alterar nada; outros erros continuam subindo', () => {
    const before = s().project;
    applyCounted('x', (): { project: Project; n: number } => { throw new TimelineError('Faixa bloqueada', 'LOCKED'); }, (r) => r.n, 'nada', () => 'feito');
    expect(toasts()[0]).toMatchObject({ kind: 'error', message: 'Faixa bloqueada' });
    expect(s().project).toBe(before);
    expect(() => applyCounted('x', (): { project: Project; n: number } => { throw new Error('bug'); }, (r) => r.n, 'nada', () => 'feito')).toThrow('bug');
  });
});

describe('focusTrackId e onSelection', () => {
  it('sem faixa nem seleção não há faixa em foco', () => {
    expect(focusTrackId()).toBeNull();
  });

  it('a faixa em foco é a selecionada; sem ela, a do primeiro clipe selecionado', () => {
    s().addToTimeline('a');
    const track = s().project.tracks[0]!;
    s().select([track.clips[0]!.id]);
    expect(focusTrackId()).toBe(track.id);
    s().selectTrack(track.id);
    expect(focusTrackId()).toBe(track.id);
  });

  it('onSelection entrega os ids selecionados à operação', () => {
    s().addToTimeline('a');
    const id = s().project.tracks[0]!.clips[0]!.id;
    s().select([id]);
    let seen: string[] = [];
    onSelection('ver', (p, ids) => {
      seen = ids;
      return p;
    })();
    expect(seen).toEqual([id]);
  });
});
