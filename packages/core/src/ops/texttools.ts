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
