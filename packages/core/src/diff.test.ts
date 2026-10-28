import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import { TextClipSchema, type MediaClip, type Project } from './schema';
import { addClip, deleteClips, moveClips, trimClip, updateClip } from './ops/clips';
import { addMarker, addTrack, removeMarker } from './ops/tracks';
import { fixtureProject, mediaClip } from './testing';
import { describeDiff, diffProjects } from './diff';

function base() {
  const { project, trackId } = fixtureProject();
  const a = mediaClip('m1', 0, 4);
  const b = mediaClip('m1', 5, 4);
  return { p: addClip(addClip(project, trackId, a), trackId, b), a, b, trackId };
}

describe('diffProjects', () => {
  it('projetos iguais são idênticos e a descrição é vazia', () => {
    const { p } = base();
    const d = diffProjects(p, JSON.parse(JSON.stringify(p)) as Project);
    expect(d.identical).toBe(true);
    expect(describeDiff(d)).toEqual([]);
  });

  it('detecta clipes adicionados e removidos', () => {
    const { p, a, trackId } = base();
    const extra = mediaClip('m1', 10, 2);
    const after = deleteClips(addClip(p, trackId, extra), [a.id], { ripple: false });
    const d = diffProjects(p, after);
    expect(d.added).toEqual([extra.id]);
    expect(d.removed).toEqual([a.id]);
    expect(d.durationDelta).toBe(3); // 9 s → 12 s
  });

  it('separa movido, redimensionado e ajustado', () => {
    const { p, a, b } = base();
    let after = moveClips(p, [b.id], 1);
    after = trimClip(after, a.id, 'end', 3);
    after = updateClip(after, a.id, (c) => ({ ...c, audio: { ...(c as MediaClip).audio, volume: 0.5 } }) as MediaClip);
    const d = diffProjects(p, after);
    expect(d.moved).toEqual([b.id]);
    expect(d.resized).toEqual([a.id]);
    expect(d.adjusted).toEqual([a.id]);
  });

  it('texto reescrito conta como retyped sem virar "ajustado"', () => {
    const { p } = base();
    const tt = addTrack(p, 'text');
    const t = TextClipSchema.parse({ id: newId('clp'), type: 'text', start: 0, duration: 2, text: 'Antes' });
    const before = addClip(tt.project, tt.track.id, t);
    const after = updateClip(before, t.id, (c) => ({ ...c, text: 'Depois' }));
    const d = diffProjects(before, after);
    expect(d.retyped).toEqual([t.id]);
    expect(d.adjusted).toEqual([]);
  });

  it('conta faixas e marcadores', () => {
    const { p } = base();
    const withMarker = addMarker(p, 3).project;
    const m = withMarker.markers[0]!;
    const after = addTrack(addMarker(withMarker, 5).project, 'audio').project;
    const d = diffProjects(withMarker, after);
    expect(d.markersAdded).toBe(1);
    expect(d.tracksAdded).toHaveLength(1);
    const gone = diffProjects(withMarker, removeMarker(withMarker, m.id));
    expect(gone.markersRemoved).toBe(1);
  });

  it('ordem das chaves não gera diferença falsa', () => {
    const { p, a } = base();
    const reordered = updateClip(p, a.id, (c) => ({ ...c, audio: Object.fromEntries(Object.entries((c as MediaClip).audio).reverse()) as MediaClip['audio'] }));
    expect(diffProjects(p, reordered).adjusted).toEqual([]);
  });
});

describe('describeDiff', () => {
  it('frases em português com singular e plural e a variação de duração', () => {
    const { p, a, b, trackId } = base();
    const after = addClip(deleteClips(moveClips(p, [b.id], 2), [a.id], { ripple: false }), trackId, mediaClip('m1', 20, 2));
    const lines = describeDiff(diffProjects(p, after));
    expect(lines).toContain('1 clipe adicionado');
    expect(lines).toContain('1 clipe removido');
    expect(lines).toContain('1 clipe movido');
    expect(lines).toContain('Duração aumentou 13,0 s'); // 9 s → 22 s
  });
});
