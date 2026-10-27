import { TimelineError } from '../errors';
import type { CaptionClip, Clip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { moveClips } from './clips';
import { assertTracksValid, assertUnlocked, requireClip, withTrackClips } from './helpers';

/** Limite padrão de leitura confortável: caracteres por segundo (referência usada em legendagem profissional). */
export const MAX_CHARS_PER_SECOND = 20;

/** Caracteres por segundo de uma legenda (quebras de linha não contam). */
export function readingSpeed(text: string, duration: number): number {
  const chars = text.replace(/\s*\n\s*/g, ' ').trim().length;
  return duration > 0 ? chars / duration : Infinity;
}

/** Ids das legendas que passam do limite de leitura (rápidas demais para ler), de todas as faixas desbloqueadas. */
export function fastCaptionIds(p: Project, maxCps = MAX_CHARS_PER_SECOND): string[] {
  const out: string[] = [];
  for (const t of p.tracks) {
    if (t.kind !== 'caption' || t.locked) continue;
    for (const c of t.clips) if (c.type === 'caption' && readingSpeed(c.text, c.duration) > maxCps) out.push(c.id);
  }
  return out;
}

/** Desloca as legendas escolhidas (ou todas as legendas desbloqueadas) por `delta` segundos; não passa de 0 s. */
export function shiftCaptions(p: Project, delta: number, ids?: string[]): Project {
  const targets = ids ?? p.tracks.filter((t) => t.kind === 'caption' && !t.locked).flatMap((t) => t.clips.filter((c) => c.type === 'caption').map((c) => c.id));
  if (!targets.length || Math.abs(delta) < 1e-9) return p;
  return moveClips(p, targets, delta);
}

/**
 * Junta legendas da mesma faixa em uma só: do início da primeira ao fim da última, com os textos unidos por espaço
 * e as palavras temporizadas reposicionadas. Não pode haver outro clipe entre elas.
 */
export function mergeCaptions(p: Project, ids: string[]): { project: Project; mergedId: string } {
  const unique = [...new Set(ids)];
  if (unique.length < 2) throw new TimelineError('Selecione pelo menos duas legendas para juntar', 'OUT_OF_RANGE');
  const found = unique.map((id) => requireClip(p, id));
  const track = found[0]!.track;
  if (found.some((f) => f.track.id !== track.id)) throw new TimelineError('As legendas precisam estar na mesma faixa', 'KIND_MISMATCH');
  assertUnlocked(track);
  if (found.some((f) => f.clip.type !== 'caption')) throw new TimelineError('Só legendas podem ser juntadas', 'KIND_MISMATCH');
  const caps = found.map((f) => f.clip as CaptionClip).sort((a, b) => a.start - b.start);
  const first = caps[0]!;
  const end = Math.max(...caps.map(clipEnd));
  const others = track.clips.filter((c) => !unique.includes(c.id));
  if (others.some((c) => c.start < end - 1e-6 && clipEnd(c) > first.start + 1e-6)) throw new TimelineError('Há outro clipe entre as legendas escolhidas', 'OVERLAP');

  const words = caps.flatMap((c) => c.words.map((w) => ({ ...w, start: round6(w.start + c.start - first.start), end: round6(w.end + c.start - first.start) })));
  const merged: CaptionClip = {
    ...first,
    duration: round6(end - first.start),
    text: caps.map((c) => c.text.trim()).filter(Boolean).join(' '),
    // só mantém o tempo por palavra se todas as legendas tinham (senão ficaria pela metade)
    words: caps.every((c) => c.words.length > 0) ? words : [],
  };
  const drop = new Set(caps.slice(1).map((c) => c.id));
  const next = withTrackClips(p, track.id, (cs) => cs.filter((c) => !drop.has(c.id)).map((c) => (c.id === first.id ? (merged as Clip) : c)));
  assertTracksValid(next, [track.id]);
  return { project: next, mergedId: first.id };
}
