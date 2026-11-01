import { TimelineError } from '../errors';
import { cuesToCaptionClips } from '../captions';
import { newId } from '../ids';
import { projectDuration } from '../project';
import type { CaptionClip, Clip, Project, TextClip, TextStyle, TrackKind } from '../schema';
import { TextClipSchema, TextStyleSchema } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { addClip, updateClip } from './clips';
import { requireClip } from './helpers';
import { addTrack } from './tracks';

type TextLike = TextClip | CaptionClip;
const isTextLike = (c: Clip): c is TextLike => c.type === 'text' || c.type === 'caption';

/** Aplica fn a cada clipe de texto/legenda dentre os ids (os demais são ignorados); falha se nenhum servir. */
export function mapTexts(p: Project, ids: string[], fn: (c: TextLike) => TextLike): Project {
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    if (!isTextLike(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => fn(c as TextLike));
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de texto ou legenda', 'KIND_MISMATCH');
  return next;
}

/** Devolve uma faixa do tipo, desbloqueada e livre em [start, end]; cria uma nova se não houver. */
function freeTrack(p: Project, kind: TrackKind, start: number, end: number): { project: Project; trackId: string } {
  const free = p.tracks.find((t) => t.kind === kind && !t.locked && !t.clips.some((c) => c.start < end - EPS && clipEnd(c) > start + EPS));
  if (free) return { project: p, trackId: free.id };
  const r = addTrack(p, kind);
  return { project: r.project, trackId: r.track.id };
}

/** Aplica parte do estilo (cor, fonte, tamanho, contorno, sombra...) a todos os textos/legendas escolhidos. */
export function setTextStyle(p: Project, ids: string[], patch: Partial<TextStyle>): Project {
  if (!TextStyleSchema.partial().safeParse(patch).success) throw new TimelineError('Valor inválido no estilo do texto', 'INVALID');
  return mapTexts(p, ids, (c) => ({ ...c, style: { ...c.style, ...patch } }) as TextLike);
}

/** Coloca os textos escolhidos centralizados no topo, no meio ou na base do quadro. */
export function placeText(p: Project, ids: string[], where: 'top' | 'middle' | 'bottom'): Project {
  const y = where === 'top' ? -0.38 : where === 'bottom' ? 0.38 : 0;
  return mapTexts(p, ids, (c) => ({ ...c, transform: { ...c.transform, x: 0, y } }) as TextLike);
}

/** Numera os textos escolhidos na ordem em que aparecem, trocando {n} no modelo ("Cena {n}") a partir de ${first}. */
export function numberTexts(p: Project, ids: string[], template: string, first = 1): Project {
  if (!template.includes('{n}')) throw new TimelineError('O modelo precisa conter {n}, onde entra o número', 'INVALID');
  const picked = [...new Set(ids)].map((id) => requireClip(p, id).clip).filter((c): c is TextClip => c.type === 'text');
  if (!picked.length) throw new TimelineError('Selecione clipes de texto', 'KIND_MISMATCH');
  picked.sort((a, b) => a.start - b.start);
  let next = p;
  picked.forEach((c, i) => {
    next = updateClip(next, c.id, (x) => ({ ...(x as TextClip), text: template.split('{n}').join(String(first + i)) }));
  });
  return next;
}

/** Normaliza um texto: espaços/tabs repetidos viram um, espaços nas pontas das linhas somem e no máximo uma linha em branco seguida. */
export function cleanString(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Limpa o texto de todos os textos/legendas (ou só dos ids), ignorando faixas bloqueadas. Devolve quantos mudaram. */
export function cleanText(p: Project, ids?: string[]): { project: Project; changed: number } {
  const only = ids ? new Set(ids) : null;
  let next = p;
  let changed = 0;
  for (const t of p.tracks) {
    if (t.locked) continue;
    for (const c of t.clips) {
      if (!isTextLike(c) || (only && !only.has(c.id))) continue;
      const text = cleanString(c.text);
      if (text === c.text) continue;
      next = updateClip(next, c.id, (x) => ({ ...(x as TextLike), text }) as TextLike);
      changed++;
    }
  }
  return { project: next, changed };
}

/** Insere uma cartela de título grande e centralizada numa faixa de texto livre (cria se preciso). */
export function addTitleCard(p: Project, text: string, start: number, duration: number): { project: Project; clipId: string } {
  if (!text.trim()) throw new TimelineError('Escreva o texto do título', 'INVALID');
  if (!(start >= 0) || !(duration > 0)) throw new TimelineError('Início e duração inválidos', 'OUT_OF_RANGE');
  const fx = round6(Math.min(0.4, duration / 3));
  const clip = TextClipSchema.parse({
    id: newId('clp'),
    type: 'text',
    text: text.trim(),
    start: round6(start),
    duration: round6(duration),
    style: { fontSize: 110, bold: true, shadowBlur: 14, shadowColor: '#000000', strokeWidth: 0 },
    animationIn: { type: 'pop', duration: fx },
    animationOut: { type: 'fade', duration: fx },
  });
  const f = freeTrack(p, 'text', clip.start, clipEnd(clip));
  return { project: addClip(f.project, f.trackId, clip), clipId: clip.id };
}
