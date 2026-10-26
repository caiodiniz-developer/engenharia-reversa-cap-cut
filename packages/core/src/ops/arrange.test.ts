import { describe, expect, it } from 'vitest';
import { findClip } from '../project';
import { addClip, fixtureProject, mediaClip } from '../testing';
import { addMarker } from './tracks';
import { copyAttributes, pasteAttributes, resetClipVisuals, sequenceClips, splitAtMarkers } from './arrange';
import { updateClip } from './clips';
import type { MediaClip } from '../schema';

function three() {
  const { project, trackId } = fixtureProject();
  const a = mediaClip('m1', 1, 2);
  const b = mediaClip('m1', 5, 2);
  const c = mediaClip('m1', 9, 1);
  let p = project;
  for (const x of [a, b, c]) p = addClip(p, trackId, x);
  return { p, a, b, c, trackId };
}

describe('sequenceClips', () => {
  it('encosta os clipes escolhidos a partir do início do primeiro, na ordem da faixa', () => {
    const { p, a, b, c } = three();
    const out = sequenceClips(p, [c.id, a.id, b.id]);
    expect(findClip(out, a.id)!.clip.start).toBe(1);
    expect(findClip(out, b.id)!.clip.start).toBe(3);
    expect(findClip(out, c.id)!.clip.start).toBe(5);
  });

  it('não mexe nos clipes que não foram escolhidos', () => {
    const { p, a, b, c } = three();
    const out = sequenceClips(p, [b.id, c.id]);
    expect(findClip(out, a.id)!.clip.start).toBe(1);
    expect(findClip(out, b.id)!.clip.start).toBe(5);
    expect(findClip(out, c.id)!.clip.start).toBe(7);
  });

  it('falha quando o resultado sobreporia um clipe não escolhido', () => {
    const { project, trackId } = fixtureProject();
    const a = mediaClip('m1', 0, 2);
    const mid = mediaClip('m1', 3, 2);
    const c = mediaClip('m1', 8, 2);
    let p = project;
    for (const x of [a, mid, c]) p = addClip(p, trackId, x);
    expect(() => sequenceClips(p, [a.id, c.id])).toThrow();
  });
});

describe('splitAtMarkers', () => {
  it('divide o clipe em cada marcador interno e ignora os que caem nas bordas', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 10);
    let p = addClip(project, trackId, c);
    for (const t of [2, 5, 10, 0]) p = addMarker(p, t).project;
    const out = splitAtMarkers(p, [c.id]);
    const clips = out.tracks[0]!.clips.sort((x, y) => x.start - y.start);
    expect(clips.map((x) => [x.start, x.duration])).toEqual([[0, 2], [2, 3], [5, 5]]);
  });

  it('sem marcadores dentro do clipe nada muda', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 4);
    const p = addMarker(addClip(project, trackId, c), 8).project;
    expect(splitAtMarkers(p, [c.id]).tracks[0]!.clips).toHaveLength(1);
  });
});

describe('copiar e colar atributos', () => {
  const styled = () => {
    const { project, trackId } = fixtureProject();
    const src = mediaClip('m1', 0, 3);
    const dst = mediaClip('m1', 3, 3, { keyframes: { volume: [{ time: 0, value: 0.5, easing: 'linear' }] } as never });
    let p = addClip(addClip(project, trackId, src), trackId, dst);
    p = updateClip(p, src.id, (c) => ({
      ...c,
      transform: { ...(c as MediaClip).transform, scale: 1.5, rotation: 12, opacity: 0.6 },
      effects: [{ id: 'fx-original', type: 'blur', enabled: true, params: { amount: 4 } }],
      keyframes: { x: [{ time: 0, value: 0, easing: 'linear' }, { time: 1, value: 0.2, easing: 'linear' }] } as never,
    }));
    return { p, src, dst };
  };

  it('cola transformação, efeitos (com ids novos) e keyframes visuais, preservando o volume do destino', () => {
    const { p, src, dst } = styled();
    const attrs = copyAttributes(p, src.id);
    const out = pasteAttributes(p, attrs, [dst.id]);
    const d = findClip(out, dst.id)!.clip as MediaClip;
    expect(d.transform).toMatchObject({ scale: 1.5, rotation: 12, opacity: 0.6 });
    expect(d.effects).toHaveLength(1);
    expect(d.effects[0]!.type).toBe('blur');
    expect(d.effects[0]!.id).not.toBe('fx-original');
    expect(d.keyframes.x).toHaveLength(2);
    expect(d.keyframes.volume).toHaveLength(1);
  });

  it('ignora destinos de outro tipo e não altera a origem', () => {
    const { p, src } = styled();
    const attrs = copyAttributes(p, src.id);
    const wrong = { ...attrs, type: 'text' as const };
    expect(pasteAttributes(p, wrong, [src.id])).toEqual(p);
  });

  it('a cópia é independente: mudar a origem depois não altera o que foi copiado', () => {
    const { p, src } = styled();
    const attrs = copyAttributes(p, src.id);
    const changed = updateClip(p, src.id, (c) => ({ ...c, transform: { ...(c as MediaClip).transform, scale: 3 } }));
    expect(attrs.transform.scale).toBe(1.5);
    expect((findClip(changed, src.id)!.clip as MediaClip).transform.scale).toBe(3);
  });
});

describe('resetClipVisuals', () => {
  it('volta transformação, efeitos e keyframes visuais ao padrão e preserva o áudio', () => {
    const { project, trackId } = fixtureProject();
    const c = mediaClip('m1', 0, 3, { audio: { volume: 0.4 } as never, keyframes: { volume: [{ time: 0, value: 0.5, easing: 'linear' }] } as never });
    let p = addClip(project, trackId, c);
    p = updateClip(p, c.id, (x) => ({ ...x, transform: { ...(x as MediaClip).transform, scale: 2, flipH: true }, effects: [{ id: 'e', type: 'blur', enabled: true, params: {} }], stabilize: 10 }) as MediaClip);
    const out = findClip(resetClipVisuals(p, [c.id]), c.id)!.clip as MediaClip;
    expect(out.transform).toMatchObject({ scale: 1, flipH: false, x: 0, y: 0, opacity: 1 });
    expect(out.effects).toEqual([]);
    expect(out.stabilize).toBe(0);
    expect(out.audio.volume).toBe(0.4);
    expect(out.keyframes.volume).toHaveLength(1);
  });
});
