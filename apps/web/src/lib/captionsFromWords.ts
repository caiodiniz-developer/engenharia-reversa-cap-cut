import { CaptionClipSchema, newId, round6, wordsToCues, type CaptionClip, type MediaClip } from '@editor/core';
import { rangeToTimeline } from './timemap';

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

/**
 * Agrupa palavras transcritas em legendas e posiciona na timeline segundo o clipe de origem.
 * Mantém os tempos reais de cada palavra (para o destaque da palavra falada).
 */
export function captionsFromWords(words: TimedWord[], clip: MediaClip | undefined, opts: { maxChars?: number; highlightColor?: string } = {}): CaptionClip[] {
  const cues = wordsToCues(words, { maxChars: opts.maxChars ?? 38 });
  const out: CaptionClip[] = [];
  for (const cue of cues) {
    const mapped = clip ? rangeToTimeline(clip, { start: cue.start, end: cue.end }) : { start: cue.start, end: cue.end };
    if (!mapped) continue;
    const inCue = words.filter((w) => w.start >= cue.start - 1e-6 && w.end <= cue.end + 1e-6);
    const scale = clip ? 1 / clip.speed : 1;
    const base = clip ? mapped.start : cue.start;
    const tl = (t: number) => (clip ? rangeToTimeline(clip, { start: t, end: t + 1e-3 })?.start ?? mapped.start : t);
    const rel = inCue.map((w) => {
      const s = clip ? clip.reverse ? 0 : Math.max(0, tl(w.start) - base) : w.start - base;
      return { text: w.text, start: round6(s), end: round6(Math.max(s + 0.02, s + (w.end - w.start) * scale)) };
    });
    out.push(
      CaptionClipSchema.parse({
        id: newId('clp'),
        type: 'caption',
        start: round6(mapped.start),
        duration: round6(Math.max(0.1, mapped.end - mapped.start)),
        text: cue.text,
        words: clip?.reverse ? [] : rel.map((w) => ({ ...w, end: Math.min(w.end, round6(mapped.end - mapped.start)) })),
        highlightColor: opts.highlightColor,
      }),
    );
  }
  return out;
}
