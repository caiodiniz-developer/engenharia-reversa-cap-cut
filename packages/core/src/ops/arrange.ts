import { TimelineError } from '../errors';
import { newId } from '../ids';
import { findClip } from '../project';
import { TransformSchema, type Clip, type EffectInstance, type Keyframes, type Project, type Transform } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { splitClips, updateClip } from './clips';
import { assertTracksValid, assertUnlocked, minClipDuration, requireClip, withTrackClips } from './helpers';

/**
 * Encosta os clipes escolhidos, em sequência, a partir do início do primeiro deles (por faixa).
 * Os clipes não escolhidos não se movem; se o resultado sobrepuser algum, a operação falha.
 */
export function sequenceClips(p: Project, ids: string[]): Project {
  const byTrack = new Map<string, Clip[]>();
  for (const id of new Set(ids)) {
    const { track, clip } = requireClip(p, id);
    assertUnlocked(track);
    byTrack.set(track.id, [...(byTrack.get(track.id) ?? []), clip]);
  }
  let next = p;
  for (const [trackId, clips] of byTrack) {
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    let cursor = sorted[0]!.start;
    const moved = new Map<string, number>();
    for (const c of sorted) {
      moved.set(c.id, round6(cursor));
      cursor = round6(cursor + c.duration);
    }
    next = withTrackClips(next, trackId, (cs) => cs.map((c) => (moved.has(c.id) ? ({ ...c, start: moved.get(c.id)! } as Clip) : c)));
  }
  assertTracksValid(next, byTrack.keys());
  return next;
}

/** Divide os clipes escolhidos em cada marcador que cai dentro deles (a pelo menos 1 quadro das bordas). */
export function splitAtMarkers(p: Project, ids: string[]): Project {
  const min = minClipDuration(p);
  let next = p;
  const pool = new Set(ids);
  for (const marker of [...p.markers].sort((a, b) => a.time - b.time)) {
    const hit = [...pool].filter((id) => {
      const f = findClip(next, id);
      if (!f || f.track.locked) return false;
      return marker.time >= f.clip.start + min - EPS && marker.time <= clipEnd(f.clip) - min + EPS;
    });
    if (!hit.length) continue;
    const r = splitClips(next, hit, marker.time);
    next = r.project;
    for (const right of Object.values(r.rightIds)) pool.add(right);
  }
  return next;
}

/** Atributos visuais copiáveis entre clipes do mesmo tipo. */
export interface ClipAttributes {
  type: Clip['type'];
  transform: Transform;
  keyframes: Keyframes;
  effects?: EffectInstance[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Copia posição, escala, rotação, opacidade, recorte, keyframes (e efeitos, em clipes de mídia). */
export function copyAttributes(p: Project, clipId: string): ClipAttributes {
  const { clip } = requireClip(p, clipId);
  if (clip.type === 'caption') throw new TimelineError('Legendas não têm atributos visuais copiáveis', 'KIND_MISMATCH');
  const { volume: _volume, ...visual } = clip.keyframes as Keyframes & { volume?: unknown };
  void _volume;
  return {
    type: clip.type,
    transform: clone(clip.transform),
    keyframes: clone(visual) as Keyframes,
    ...(clip.type === 'media' ? { effects: clone(clip.effects) } : {}),
  };
}

/** Aplica atributos copiados a outros clipes do mesmo tipo (efeitos ganham novos ids). Mantém o keyframe de volume. */
export function pasteAttributes(p: Project, attrs: ClipAttributes, targetIds: string[]): Project {
  let next = p;
  for (const id of new Set(targetIds)) {
    const { clip } = requireClip(next, id);
    if (clip.type !== attrs.type) continue;
    next = updateClip(next, id, (c) => {
      const kept = c.keyframes.volume ? { volume: c.keyframes.volume } : {};
      const merged = { ...c, transform: clone(attrs.transform), keyframes: { ...clone(attrs.keyframes), ...kept } } as Clip;
      if (merged.type === 'media' && attrs.effects) merged.effects = attrs.effects.map((fx) => ({ ...clone(fx), id: newId('fx') }));
      return merged;
    });
  }
  return next;
}

/** Volta transformação, efeitos, máscara e keyframes visuais ao padrão (o áudio não muda). */
export function resetClipVisuals(p: Project, ids: string[]): Project {
  let next = p;
  for (const id of new Set(ids)) {
    const { clip } = requireClip(next, id);
    if (clip.type === 'caption') continue;
    next = updateClip(next, id, (c) => {
      const kept = c.keyframes.volume ? { volume: c.keyframes.volume } : {};
      const base = { ...c, transform: TransformSchema.parse({}), keyframes: kept } as Clip;
      if (base.type === 'media') {
        base.effects = [];
        base.mask = undefined;
        base.stabilize = 0;
      }
      return base;
    });
  }
  return next;
}
