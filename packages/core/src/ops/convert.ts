import { TimelineError } from '../errors';
import { cuesToCaptionClips } from '../captions';
import { newId } from '../ids';
import type { CaptionClip, Project, TextClip } from '../schema';
import { TextClipSchema } from '../schema';
import { clipEnd, round6 } from '../time';
import { addClip, deleteClips } from './clips';
import { assertTracksValid, assertUnlocked, minClipDuration, requireClip, withTrackClips } from './helpers';
import { freeTrack } from './texttools';

/**
 * Divide um texto de várias linhas em um texto por linha, cada um com a mesma fatia do tempo do original, um depois do outro
 * (bom para listas que aparecem uma a uma). Linhas em branco são ignoradas. O primeiro mantém o id original.
 */
export function splitTextLines(p: Project, clipId: string): { project: Project; ids: string[] } {
  const { clip, track } = requireClip(p, clipId);
  if (clip.type !== 'text') throw new TimelineError('Selecione um clipe de texto', 'KIND_MISMATCH');
  assertUnlocked(track);
  const lines = clip.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new TimelineError('O texto precisa ter pelo menos duas linhas', 'INVALID');
  const each = clip.duration / lines.length;
  if (each < minClipDuration(p) - 1e-9) throw new TimelineError('Linhas demais para a duração do clipe', 'OUT_OF_RANGE');
  const pieces = lines.map((text, i): TextClip => {
    const start = round6(clip.start + i * each);
    const end = i === lines.length - 1 ? clipEnd(clip) : round6(clip.start + (i + 1) * each);
    return { ...clip, id: i === 0 ? clip.id : newId('clp'), linkId: i === 0 ? clip.linkId : undefined, groupId: i === 0 ? clip.groupId : undefined, text, start, duration: round6(end - start) };
  });
  const next = withTrackClips(p, track.id, (cs) => [...cs.filter((c) => c.id !== clip.id), ...pieces]);
  assertTracksValid(next, [track.id]);
  return { project: next, ids: pieces.map((c) => c.id) };
}

/** Converte textos em legendas (com as palavras repartidas no tempo) no mesmo instante e duração, em faixas de legenda livres. */
export function textToCaptions(p: Project, ids: string[]): { project: Project; ids: string[] } {
  const found = [...new Set(ids)].map((id) => requireClip(p, id)).filter((x) => x.clip.type === 'text');
  if (!found.length) throw new TimelineError('Selecione clipes de texto', 'KIND_MISMATCH');
  for (const f of found) assertUnlocked(f.track);
  const made: CaptionClip[] = found.flatMap(({ clip }) => cuesToCaptionClips([{ start: clip.start, end: clipEnd(clip), text: (clip as TextClip).text.replace(/\s+/g, ' ').trim() }]));
  let next = deleteClips(p, found.map((f) => f.clip.id), { ripple: false });
  for (const c of made) {
    const f = freeTrack(next, 'caption', c.start, clipEnd(c));
    next = addClip(f.project, f.trackId, c);
  }
  return { project: next, ids: made.map((c) => c.id) };
}

/** Converte legendas em textos comuns (mesmo texto, estilo, posição, animações, instante e duração), em faixas de texto livres. */
export function captionsToText(p: Project, ids: string[]): { project: Project; ids: string[] } {
  const found = [...new Set(ids)].map((id) => requireClip(p, id)).filter((x) => x.clip.type === 'caption');
  if (!found.length) throw new TimelineError('Selecione legendas', 'KIND_MISMATCH');
  for (const f of found) assertUnlocked(f.track);
  const made = found.map(({ clip }) => {
    const c = clip as CaptionClip;
    return TextClipSchema.parse({ id: newId('clp'), type: 'text', text: c.text, start: c.start, duration: c.duration, style: c.style, transform: c.transform, animationIn: c.animationIn, animationOut: c.animationOut });
  });
  let next = deleteClips(p, found.map((f) => f.clip.id), { ripple: false });
  for (const c of made) {
    const f = freeTrack(next, 'text', c.start, clipEnd(c));
    next = addClip(f.project, f.trackId, c);
  }
  return { project: next, ids: made.map((c) => c.id) };
}
