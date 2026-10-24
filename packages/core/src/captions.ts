import { newId } from './ids';
import type { CaptionClip, CaptionWord } from './schema';
import { round6 } from './time';

export interface Cue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(s: string): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(s.trim());
  if (!m) throw new Error(`Timestamp inválido: "${s}"`);
  const [, h, mi, se, ms] = m;
  return round6(Number(h ?? 0) * 3600 + Number(mi) * 60 + Number(se) + Number(ms!.padEnd(3, '0')) / 1000);
}

function parseCues(input: string): Cue[] {
  const blocks = input.replace(/\r/g, '').replace(/^﻿/, '').split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [a, b] = lines[timeIdx]!.split('-->');
    const start = parseTimestamp(a!.trim());
    // VTT pode ter configurações de cue depois do tempo final ("00:01.000 align:start").
    const end = parseTimestamp(b!.trim().split(/\s+/)[0]!);
    const text = lines
      .slice(timeIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '');
    if (end > start && text.trim()) cues.push({ start, end, text });
  }
  return cues;
}

export const parseSrt = parseCues;
export const parseVtt = (input: string): Cue[] => parseCues(input.replace(/^WEBVTT[^\n]*\n/, ''));

function fmt(t: number, sep: ',' | '.'): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${fmt(c.start, ',')} --> ${fmt(c.end, ',')}\n${c.text}\n`).join('\n');
}

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${fmt(c.start, '.')} --> ${fmt(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}

/** Cues absolutos (tempo da timeline) -> clipes de legenda. Palavras são distribuídas proporcionalmente ao tamanho. */
export function cuesToCaptionClips(cues: Cue[], offset = 0): CaptionClip[] {
  return cues.map((cue) => {
    const duration = round6(cue.end - cue.start);
    const tokens = cue.text.split(/\s+/).filter(Boolean);
    const totalChars = tokens.reduce((n, t) => n + t.length, 0) || 1;
    let acc = 0;
    const words: CaptionWord[] = tokens.map((text) => {
      const start = round6((acc / totalChars) * duration);
      acc += text.length;
      return { text, start, end: round6((acc / totalChars) * duration) };
    });
    return {
      id: newId('clp'),
      type: 'caption' as const,
      start: round6(cue.start + offset),
      duration,
      text: cue.text.replace(/\n/g, ' '),
      words,
      style: { fontFamily: 'Arial', fontSize: 56, color: '#ffffff', bold: true, italic: false, align: 'center' as const, strokeColor: '#000000', strokeWidth: 6, shadowColor: '#000000', shadowBlur: 0, shadowX: 0, shadowY: 0, maxWidth: 0.9 },
      transform: { x: 0, y: 0.32, scale: 1, rotation: 0, opacity: 1, flipH: false, flipV: false, crop: { l: 0, t: 0, r: 0, b: 0 } },
      animationIn: { type: 'none' as const, duration: 0.2 },
      animationOut: { type: 'none' as const, duration: 0.2 },
      keyframes: {},
    };
  });
}

/** Clipes de legenda -> cues absolutos (para exportar SRT/VTT). */
export function captionClipsToCues(clips: CaptionClip[]): Cue[] {
  return [...clips]
    .sort((a, b) => a.start - b.start)
    .map((c) => ({ start: c.start, end: round6(c.start + c.duration), text: c.text }));
}

/** Agrupa palavras com tempo (saída típica do Whisper) em cues de no máximo `maxChars` caracteres / `maxDur` s. */
export function wordsToCues(
  words: Array<{ text: string; start: number; end: number }>,
  opts: { maxChars?: number; maxDur?: number } = {},
): Cue[] {
  const maxChars = opts.maxChars ?? 42;
  const maxDur = opts.maxDur ?? 5;
  const cues: Cue[] = [];
  let cur: typeof words = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({ start: cur[0]!.start, end: cur[cur.length - 1]!.end, text: cur.map((w) => w.text).join(' ') });
    cur = [];
  };
  for (const w of words) {
    const text = [...cur, w].map((x) => x.text).join(' ');
    if (cur.length && (text.length > maxChars || w.end - cur[0]!.start > maxDur)) flush();
    cur.push(w);
    if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  return cues;
}
