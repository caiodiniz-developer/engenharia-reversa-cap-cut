import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, type MediaClip } from '@editor/core';
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
  urls: { original: '', proxy: null, thumb: null, waveform: null, film: null },
  ...extra,
});
const s = () => useEditor.getState();
const clips = () => s().project.tracks.flatMap((t) => t.clips) as MediaClip[];

beforeEach(() => {
  useToasts.setState({ toasts: [] });
  s().load({ id: 'p1', name: 'T', revision: 1, data: createProject('T', { fps: 30 }) }, [item('a'), item('b'), item('curta', 3), item('foto', 0, { kind: 'image', hasAudio: false })]);
});

describe('substituir mídia pelo store', () => {
  it('traz a nova mídia da biblioteca para o projeto e troca em todos os clipes', () => {
    s().addToTimeline('a');
    s().addToTimeline('a');
    expect(s().project.media.b).toBeUndefined();
    expect(s().replaceMediaWith('a', 'b')).toBe(2);
    expect(clips().map((c) => c.mediaId)).toEqual(['b', 'b']);
    expect(s().project.media.b).toBeDefined();
    s().undo();
    expect(clips().map((c) => c.mediaId)).toEqual(['a', 'a']);
  });

  it('avisa e não altera quando o tipo é diferente ou a nova mídia é curta demais', () => {
    s().addToTimeline('a');
    const before = s().project;
    expect(s().replaceMediaWith('a', 'foto')).toBe(0);
    expect(s().replaceMediaWith('a', 'curta')).toBe(0);
    expect(s().project).toBe(before);
    const msgs = useToasts.getState().toasts.map((t) => t.message).join(' | ');
    expect(msgs).toContain('mesmo tipo');
    expect(msgs).toContain('duração');
  });
});
