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
