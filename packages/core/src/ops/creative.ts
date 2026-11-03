import { TimelineError } from '../errors';
import { newId } from '../ids';
import type { Clip, MediaClip, Project } from '../schema';
import { EPS, clipEnd, round6 } from '../time';
import { setReverse } from './advanced';
import { splitClips, updateClip } from './clips';
import { assertTracksValid, assertUnlocked, requireClip, shiftFrom, withTrackClips } from './helpers';
import { mapTransform } from './motion';
import { sequenceOrder } from './reorder';
import { repeatClip } from './repeat';
import type { Corner } from './texttools';

/** Clipe de mídia pedido (falha com mensagem clara se for texto ou legenda). */
function requireMediaClip(p: Project, id: string): MediaClip {
  const { clip } = requireClip(p, id);
  if (clip.type !== 'media') throw new TimelineError('Essa ferramenta vale só para clipes de vídeo, imagem ou áudio', 'KIND_MISMATCH');
  return clip;
}

/** Cópia independente de um clipe de mídia: id novo, sem ligação, grupo ou transição, com efeitos de ids novos. */
function cloneMedia(clip: MediaClip): MediaClip {
  const copy: MediaClip = JSON.parse(JSON.stringify(clip));
  copy.id = newId('clp');
  copy.linkId = undefined;
  copy.groupId = undefined;
  copy.transitionIn = undefined;
  copy.effects = copy.effects.map((e) => ({ ...e, id: newId('fx') }));
  return copy;
}

export interface SpeedRampOptions {
  /** Velocidade no começo (0,1 a 16). */
  from: number;
  /** Velocidade no fim (0,1 a 16). */
  to: number;
  /** Em quantos trechos o clipe é dividido (3 a 12). Padrão 6. */
  parts?: number;
  /** Curva suave (acelera/desacelera nas pontas) em vez de linear. */
  smooth?: boolean;
}

/**
 * Rampa de velocidade: divide o clipe em ${parts} trechos que cobrem partes iguais da mídia, cada um com a sua velocidade
 * (de from até to). A duração total muda e o resto da faixa anda junto. Não vale para clipes invertidos, congelados,
 * ligados a outro clipe ou com keyframes. O primeiro trecho mantém o id original.
 */
export function speedRamp(p: Project, clipId: string, opts: SpeedRampOptions): { project: Project; ids: string[] } {
  const { from, to } = opts;
  const parts = opts.parts ?? 6;
  if (!(from >= 0.1 && from <= 16 && to >= 0.1 && to <= 16)) throw new TimelineError('A velocidade vai de 0,1× a 16×', 'OUT_OF_RANGE');
  if (!Number.isInteger(parts) || parts < 3 || parts > 12) throw new TimelineError('Escolha de 3 a 12 trechos', 'OUT_OF_RANGE');
  const clip = requireMediaClip(p, clipId);
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  if (clip.reverse || clip.freeze) throw new TimelineError('A rampa não vale para clipe invertido ou congelado', 'INVALID');
  if (clip.linkId) throw new TimelineError('Desvincule o áudio antes de aplicar a rampa', 'INVALID');
  if (Object.values(clip.keyframes).some((k) => k && k.length)) throw new TimelineError('Remova os keyframes do clipe antes de aplicar a rampa', 'INVALID');
  const src = (clip.duration * clip.speed) / parts;
  const copies: MediaClip[] = [];
  let cursor = clip.start;
  for (let i = 0; i < parts; i++) {
    const t = (i + 0.5) / parts;
    const k = opts.smooth ? t * t * (3 - 2 * t) : t;
    const speed = round6(from + (to - from) * k);
    const duration = round6(src / speed);
    const base = i === 0 ? clip : cloneMedia(clip);
    copies.push({ ...base, sourceIn: round6(clip.sourceIn + i * src), speed, start: round6(cursor), duration });
    cursor = round6(cursor + duration);
  }
  const delta = round6(cursor - clipEnd(clip));
  const next = withTrackClips(p, track.id, (cs) => [...shiftFrom(cs.filter((c) => c.id !== clipId), clipEnd(clip), delta), ...copies]);
  assertTracksValid(next, [track.id]);
  return { project: next, ids: copies.map((c) => c.id) };
}

/** Efeito ida e volta: acrescenta, logo depois do clipe, uma cópia dele em reverso (ou, se já era reverso, no sentido normal). */
export function boomerang(p: Project, clipId: string): { project: Project; newId: string } {
  const clip = requireMediaClip(p, clipId);
  if (clip.freeze) throw new TimelineError('Não faz sentido repetir um quadro congelado em reverso', 'INVALID');
  const r = repeatClip(p, clipId, 1);
  const newId = r.newIds[0]!;
  return { project: setReverse(r.project, newId, !clip.reverse), newId };
}

/**
 * Efeito de gagueira (beat repeat): o trecho de ${size} s a partir de ${at} (tempo da timeline, dentro do clipe) é repetido
 * ${repeats} vezes a mais e o resto da faixa anda para dar espaço. Não vale para clipes ligados a outro.
 */
export function stutter(p: Project, clipId: string, at: number, size: number, repeats: number): { project: Project; ids: string[] } {
  if (!(size >= 0.05 && size <= 2)) throw new TimelineError('O trecho repetido vai de 0,05 s a 2 s', 'OUT_OF_RANGE');
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 16) throw new TimelineError('Repita de 1 a 16 vezes', 'OUT_OF_RANGE');
  const clip = requireMediaClip(p, clipId);
  const { track } = requireClip(p, clipId);
  assertUnlocked(track);
  if (clip.linkId) throw new TimelineError('Desvincule o áudio antes de usar a gagueira', 'INVALID');
  const end = at + size;
  if (at < clip.start - EPS || end > clipEnd(clip) + EPS) throw new TimelineError('O trecho precisa ficar inteiro dentro do clipe', 'OUT_OF_RANGE');
  let next = p;
  let middle = clipId;
  if (at > clip.start + EPS) {
    const r = splitClips(next, [clipId], round6(at));
    next = r.project;
    middle = r.rightIds[clipId]!;
  }
  if (end < clipEnd(clip) - EPS) next = splitClips(next, [middle], round6(end)).project;
  const mid = requireClip(next, middle).clip;
  const shift = round6(repeats * mid.duration);
  next = withTrackClips(next, track.id, (cs) => shiftFrom(cs, clipEnd(mid) - EPS, shift, new Set([middle])));
  const r = repeatClip(next, middle, repeats);
  return { project: r.project, ids: [middle, ...r.newIds] };
}

/** Em cada corte seco da faixa (clipes de mídia encostados), põe um fade de saída no anterior e de entrada no seguinte. */
export function smoothCuts(p: Project, trackId: string, seconds = 0.05): { project: Project; cuts: number } {
  if (!(seconds >= 0.01 && seconds <= 1)) throw new TimelineError('O fade vai de 0,01 s a 1 s', 'OUT_OF_RANGE');
  const order = sequenceOrder(p, trackId).filter((c): c is MediaClip => c.type === 'media');
  let next = p;
  let cuts = 0;
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1]!;
    const b = order[i]!;
    if (Math.abs(b.start - clipEnd(a)) > 0.05) continue;
    next = updateClip(next, a.id, (c) => ({ ...(c as MediaClip), audio: { ...(c as MediaClip).audio, fadeOut: round6(Math.min(seconds, a.duration / 2)) } }));
    next = updateClip(next, b.id, (c) => ({ ...(c as MediaClip), audio: { ...(c as MediaClip).audio, fadeIn: round6(Math.min(seconds, b.duration / 2)) } }));
    cuts++;
  }
  return { project: next, cuts };
}

/** Imagem dentro da imagem: reduz o clipe para ${size} do tamanho natural e o põe num canto do quadro, com margem de 3%. */
export function pictureInPicture(p: Project, clipId: string, corner: Corner, size = 0.3): Project {
  if (!(size >= 0.1 && size <= 0.6)) throw new TimelineError('O tamanho vai de 10% a 60%', 'OUT_OF_RANGE');
  const clip = requireMediaClip(p, clipId);
  const { width: W, height: H } = p.settings;
  const a = p.media[clip.mediaId];
  const c0 = a && a.width > 0 && a.height > 0 ? Math.min(W / a.width, H / a.height) : 1;
  const dispW = a && a.width > 0 ? (a.width * c0 * size) / W : size;
  const dispH = a && a.height > 0 ? (a.height * c0 * size) / H : size;
  const margin = 0.03;
  const x = (corner === 'tl' || corner === 'bl' ? -1 : 1) * (0.5 - dispW / 2 - margin);
  const y = (corner === 'tl' || corner === 'tr' ? -1 : 1) * (0.5 - dispH / 2 - margin);
  return mapTransform(p, [clipId], (t) => ({ ...t, scale: round6(size), x: round6(x), y: round6(y) }));
}

/**
 * Tela dividida: cada um dos dois clipes preenche metade do quadro (esquerda/direita em 'side', cima/baixo em 'stack'),
 * ampliado para cobrir a metade e cortado no centro para não deformar. Usa o tamanho real das mídias.
 */
export function splitScreen(p: Project, ids: [string, string], layout: 'side' | 'stack'): Project {
  if (ids[0] === ids[1]) throw new TimelineError('Escolha dois clipes diferentes', 'OUT_OF_RANGE');
  const { width: W, height: H } = p.settings;
  const boxW = layout === 'side' ? W / 2 : W;
  const boxH = layout === 'stack' ? H / 2 : H;
  let next = p;
  ids.forEach((id, i) => {
    const clip = requireMediaClip(next, id);
    const a = next.media[clip.mediaId];
    if (!a || !(a.width > 0) || !(a.height > 0)) throw new TimelineError('Não sei o tamanho dessa mídia para dividir a tela', 'INVALID');
    const c0 = Math.min(W / a.width, H / a.height);
    const bw = a.width * c0;
    const bh = a.height * c0;
    const s = Math.min(20, Math.max(0.01, Math.max(boxW / bw, boxH / bh)));
    const dw = bw * s;
    const dh = bh * s;
    const cropX = Math.max(0, (dw - boxW) / (2 * dw));
    const cropY = Math.max(0, (dh - boxH) / (2 * dh));
    const sign = i === 0 ? -1 : 1;
    next = mapTransform(next, [id], (t) => ({
      ...t,
      scale: round6(s),
      x: layout === 'side' ? sign * 0.25 : 0,
      y: layout === 'stack' ? sign * 0.25 : 0,
      crop: { l: round6(cropX), r: round6(cropX), t: round6(cropY), b: round6(cropY) },
    }));
  });
  return next;
}


/** Velocidade de cada trecho da rampa: do centro do primeiro (perto de from) ao centro do último (perto de to), linear ou suave. */
export function rampSpeeds(from: number, to: number, parts: number, smooth = false): number[] {
  return Array.from({ length: parts }, (_, i) => {
    const t = (i + 0.5) / parts;
    const k = smooth ? t * t * (3 - 2 * t) : t;
    return round6(from + (to - from) * k);
  });
}

/** Duração na timeline de ${sourceSeconds} s de mídia tocados com essas velocidades (partes iguais da mídia). */
export function rampResultDuration(sourceSeconds: number, speeds: number[]): number {
  if (!speeds.length) return 0;
  const each = sourceSeconds / speeds.length;
  return round6(speeds.reduce((n, v) => n + each / v, 0));
}
