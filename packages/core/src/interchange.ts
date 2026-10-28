import { chapterTime, markersToChapters } from './chapters';
import { projectDuration } from './project';
import type { Clip, MediaClip, Project, Track } from './schema';
import { clipEnd, formatTimecode, round6 } from './time';

/* ---------- EDL (CMX 3600) ---------- */

const pad3 = (n: number) => String(n).padStart(3, '0');

function edlTrackName(p: Project, track: Track): string {
  const same = p.tracks.filter((t) => t.kind === track.kind);
  const n = same.length - same.indexOf(track); // a faixa mais baixa é a 1
  const base = track.kind === 'audio' ? 'A' : 'V';
  return n > 1 ? `${base}${n}` : base;
}

/**
 * Lista de decisão de edição (EDL, formato CMX 3600, sem queda de quadros) com os clipes de mídia da timeline —
 * uma linha por clipe, com entrada/saída na origem e na timeline. Serve para levar a montagem a outros programas.
 * Textos, legendas e efeitos não fazem parte do formato e ficam de fora; mudanças de velocidade vão em comentário.
 */
export function toEdl(p: Project, title = p.name): string {
  const fps = p.settings.fps;
  const events: Array<{ rec: number; track: string; clip: MediaClip; tn: string }> = [];
  for (const t of p.tracks) {
    if (t.kind !== 'video' && t.kind !== 'audio') continue;
    const tn = edlTrackName(p, t);
    for (const c of t.clips) if (c.type === 'media') events.push({ rec: c.start, track: tn, clip: c, tn });
  }
  events.sort((a, b) => a.rec - b.rec || a.track.localeCompare(b.track));
  const lines = [`TITLE: ${title.replace(/[\r\n]+/g, ' ')}`, 'FCM: NON-DROP FRAME', ''];
  events.forEach((e, i) => {
    const c = e.clip;
    const srcIn = c.sourceIn;
    const srcOut = round6(c.sourceIn + c.duration * c.speed);
    const name = p.media[c.mediaId]?.name ?? c.mediaId;
    lines.push(`${pad3(i + 1)}  AX       ${e.track.padEnd(5)} C        ${formatTimecode(srcIn, fps)} ${formatTimecode(srcOut, fps)} ${formatTimecode(c.start, fps)} ${formatTimecode(clipEnd(c), fps)}`);
    lines.push(`* FROM CLIP NAME: ${name}`);
    if (Math.abs(c.speed - 1) > 1e-9) lines.push(`* VELOCIDADE: ${Math.round(c.speed * 100)}%`);
    if (c.reverse) lines.push('* INVERTIDO');
    lines.push('');
  });
  return lines.join('\r\n');
}

/* ---------- CSV ---------- */

/** Escapa um campo CSV (aspas duplas dobradas; campo entre aspas se tiver vírgula, aspas ou quebra de linha). */
export function csvField(v: string | number): string {
  const s = String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n');
}

const sec = (n: number) => String(round6(n)).replace('.', ',');

/** Uma linha por clipe: faixa, tipo, nome ou texto, início, fim, duração, velocidade e volume (números com vírgula decimal). */
export function timelineCsv(p: Project): string {
  const rows: Array<Array<string | number>> = [['Faixa', 'Tipo', 'Nome ou texto', 'Início (s)', 'Fim (s)', 'Duração (s)', 'Velocidade', 'Volume (%)']];
  const all: Array<{ t: Track; c: Clip }> = p.tracks.flatMap((t) => t.clips.map((c) => ({ t, c })));
  all.sort((a, b) => a.c.start - b.c.start || a.t.name.localeCompare(b.t.name));
  for (const { t, c } of all) {
    const name = c.type === 'media' ? (p.media[c.mediaId]?.name ?? c.mediaId) : c.text.replace(/\s*\n\s*/g, ' / ');
    rows.push([t.name, c.type === 'media' ? (t.kind === 'audio' ? 'áudio' : 'mídia') : c.type === 'text' ? 'texto' : 'legenda', name, sec(c.start), sec(clipEnd(c)), sec(c.duration), c.type === 'media' ? sec(c.speed) : '', c.type === 'media' ? Math.round(c.audio.volume * 100) : '']);
  }
  return toCsv(rows);
}

/* ---------- Roteiro e créditos ---------- */

/** Todos os textos e legendas em ordem de aparição, com o intervalo de cada um: "[0:03–0:05] frase". */
export function scriptText(p: Project): string {
  const items: Array<{ start: number; end: number; text: string }> = [];
  for (const t of p.tracks) for (const c of t.clips) if (c.type !== 'media') items.push({ start: c.start, end: clipEnd(c), text: c.text.replace(/\s*\n\s*/g, ' ').trim() });
  items.sort((a, b) => a.start - b.start);
  return items.filter((i) => i.text).map((i) => `[${chapterTime(i.start)}–${chapterTime(i.end)}] ${i.text}`).join('\n');
}

export interface Credit {
  name: string;
  kind: 'video' | 'audio' | 'image';
  /** Primeira aparição na timeline, em segundos. */
  firstAt: number;
  /** Tempo total na timeline, somando todos os usos. */
  total: number;
  uses: number;
}

/** Mídias usadas, na ordem da primeira aparição, com tempo total em tela. */
export function creditsList(p: Project): Credit[] {
  const map = new Map<string, Credit>();
  for (const t of p.tracks) {
    for (const c of t.clips) {
      if (c.type !== 'media') continue;
      const a = p.media[c.mediaId];
      if (!a) continue;
      const cur = map.get(c.mediaId);
      if (cur) {
        cur.firstAt = Math.min(cur.firstAt, c.start);
        cur.total = round6(cur.total + c.duration);
        cur.uses++;
      } else map.set(c.mediaId, { name: a.name, kind: a.kind, firstAt: c.start, total: c.duration, uses: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.firstAt - b.firstAt);
}

/**
 * Texto pronto para a descrição do vídeo: título, duração, capítulos (dos marcadores) e a lista de mídias usadas.
 * Seções sem conteúdo são omitidas.
 */
export function buildDescription(p: Project, opts: { title?: string } = {}): string {
  const parts: string[] = [opts.title?.trim() || p.name, `Duração: ${chapterTime(projectDuration(p))}`];
  const chapters = markersToChapters(p.markers);
  if (chapters) parts.push('', 'Capítulos', chapters);
  const credits = creditsList(p);
  if (credits.length) parts.push('', 'Mídias usadas', ...credits.map((c) => `- ${c.name} (${chapterTime(c.firstAt)})`));
  return parts.join('\n');
}
