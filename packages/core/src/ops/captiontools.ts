import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { CaptionClip, CaptionWord, Clip, Project } from '../schema';
import { round6 } from '../time';
import { updateClip } from './clips';
import { assertTracksValid, withTrackClips } from './helpers';

/** Palavras com tempo: as da legenda ou, se não houver, o texto repartido em proporção ao tamanho de cada palavra. */
function timedWords(c: CaptionClip): CaptionWord[] {
  if (c.words.length) return c.words;
  const tokens = c.text.split(/\s+/).filter(Boolean);
  const total = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let acc = 0;
  return tokens.map((text) => {
    const start = round6((acc / total) * c.duration);
    acc += text.length + 1;
    return { text, start, end: round6((acc / total) * c.duration) };
  });
}

/**
 * Quebra cada legenda com mais de ${maxChars} caracteres em legendas menores, sem cortar palavras. Cada pedaço começa quando
 * a primeira palavra dele é falada e vai até o começo do próximo, então não sobram vãos. O primeiro mantém o id original.
 */
export function splitLongCaptions(p: Project, maxChars = 42): { project: Project; created: number } {
  if (!Number.isInteger(maxChars) || maxChars < 10 || maxChars > 200) throw new TimelineError('O limite vai de 10 a 200 caracteres', 'OUT_OF_RANGE');
  const min = 1 / p.settings.fps;
  let next = p;
  let created = 0;
  for (const track of p.tracks) {
    if (track.locked) continue;
    for (const clip of track.clips) {
      if (clip.type !== 'caption' || clip.text.length <= maxChars) continue;
      const words = timedWords(clip);
      const chunks: CaptionWord[][] = [];
      let cur: CaptionWord[] = [];
      let len = 0;
      for (const w of words) {
        const add = (cur.length ? 1 : 0) + w.text.length;
        if (cur.length && len + add > maxChars) {
          chunks.push(cur);
          cur = [];
          len = 0;
        }
        len += (cur.length ? 1 : 0) + w.text.length;
        cur.push(w);
      }
      if (cur.length) chunks.push(cur);
      if (chunks.length < 2) continue;
      const pieces = chunks.map((chunk, i): CaptionClip => {
        const from = i === 0 ? 0 : chunk[0]!.start;
        const to = i === chunks.length - 1 ? clip.duration : chunks[i + 1]![0]!.start;
        const duration = round6(Math.max(to - from, min));
        return {
          ...clip,
          id: i === 0 ? clip.id : newId('clp'),
          linkId: i === 0 ? clip.linkId : undefined,
          groupId: i === 0 ? clip.groupId : undefined,
          start: round6(clip.start + from),
          duration,
          text: chunk.map((w) => w.text).join(' '),
          words: chunk.map((w) => ({ text: w.text, start: round6(Math.max(0, w.start - from)), end: round6(Math.min(duration, Math.max(w.end - from, w.start - from))) })),
        };
      });
      const trackId = track.id;
      next = withTrackClips(next, trackId, (cs) => [...cs.filter((c) => c.id !== clip.id), ...(pieces as Clip[])]);
      created += pieces.length - 1;
    }
  }
  assertTracksValid(next, next.tracks.map((t) => t.id));
  return { project: next, created };
}

/** Define (ou, com null, remove) a cor de destaque da palavra falada nas legendas escolhidas. */
export function setCaptionHighlight(p: Project, ids: string[], color: string | null): Project {
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new TimelineError('Use uma cor no formato #RRGGBB', 'INVALID');
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    const c = next.tracks.flatMap((t) => t.clips).find((x) => x.id === id);
    if (!c || c.type !== 'caption') continue;
    next = updateClip(next, id, (x) => ({ ...(x as CaptionClip), highlightColor: color ?? undefined }));
    n++;
  }
  if (!n) throw new TimelineError('Selecione legendas', 'KIND_MISMATCH');
  return next;
}
