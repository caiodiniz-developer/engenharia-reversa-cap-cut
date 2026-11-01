import { TimelineError } from '../errors';
import { upsertKeyframe } from '../keyframes';
import { findClip } from '../project';
import type { AnimatableProp, Clip, Keyframe, Project, Transform } from '../schema';
import { round6 } from '../time';
import { mulberry32 } from './arrange2';
import { updateClip } from './clips';
import { requireClip } from './helpers';

type WithTransform = Extract<Clip, { transform: Transform }>;
const hasTransform = (c: Clip): c is WithTransform => c.type === 'media' || c.type === 'text' || c.type === 'caption';

/** Aplica fn à transformação de cada clipe com imagem (mídia, texto, legenda) dentre os ids; falha se nenhum servir. */
export function mapTransform(p: Project, ids: string[], fn: (t: Transform, c: WithTransform) => Transform): Project {
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    if (!hasTransform(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => ({ ...(c as WithTransform), transform: fn((c as WithTransform).transform, c as WithTransform) }) as Clip);
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou texto', 'KIND_MISMATCH');
  return next;
}

/** Troca as curvas de keyframes das propriedades dadas no clipe (as demais ficam como estão). */
export function withKeyframes(p: Project, id: string, curves: Partial<Record<AnimatableProp, Keyframe[]>>): Project {
  return updateClip(p, id, (c) => ({ ...c, keyframes: { ...c.keyframes, ...curves } }) as Clip);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Define a opacidade (0 a 1) dos clipes escolhidos. */
export function setOpacity(p: Project, ids: string[], opacity: number): Project {
  if (!(opacity >= 0 && opacity <= 1)) throw new TimelineError('A opacidade vai de 0% a 100%', 'OUT_OF_RANGE');
  return mapTransform(p, ids, (t) => ({ ...t, opacity: round6(opacity) }));
}

/** Soma um deslocamento (fração da largura/altura do quadro) à posição dos clipes escolhidos. */
export function nudgeClips(p: Project, ids: string[], dx: number, dy: number): Project {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new TimelineError('Deslocamento inválido', 'INVALID');
  return mapTransform(p, ids, (t) => ({ ...t, x: round6(t.x + dx), y: round6(t.y + dy) }));
}

/** Multiplica a escala dos clipes escolhidos (limitada a 0,01–20). */
export function scaleClipsBy(p: Project, ids: string[], factor: number): Project {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new TimelineError('O fator de escala precisa ser positivo', 'OUT_OF_RANGE');
  return mapTransform(p, ids, (t) => ({ ...t, scale: round6(clamp(t.scale * factor, 0.01, 20)) }));
}

/** Soma graus à rotação dos clipes escolhidos; o resultado fica no intervalo (-180, 180]. */
export function rotateClipsBy(p: Project, ids: string[], degrees: number): Project {
  if (!Number.isFinite(degrees)) throw new TimelineError('Ângulo inválido', 'INVALID');
  return mapTransform(p, ids, (t) => {
    let r = (((t.rotation + degrees) % 360) + 360) % 360;
    if (r > 180) r -= 360;
    return { ...t, rotation: round6(r) };
  });
}

/** Alterna o espelhamento horizontal ('h') ou vertical ('v') dos clipes escolhidos. */
export function flipClips(p: Project, ids: string[], axis: 'h' | 'v'): Project {
  return mapTransform(p, ids, (t) => (axis === 'h' ? { ...t, flipH: !t.flipH } : { ...t, flipV: !t.flipV }));
}

/** Leva os clipes escolhidos para o centro do quadro (x = 0, y = 0), sem mexer em escala ou rotação. */
export function centerClips(p: Project, ids: string[]): Project {
  return mapTransform(p, ids, (t) => ({ ...t, x: 0, y: 0 }));
}

/**
 * Ajusta a escala da mídia ao quadro do projeto e a centraliza: 'cover' preenche tudo cortando o excesso,
 * 'contain' mostra a imagem inteira (escala 1). Precisa das dimensões da mídia.
 */
export function fillFrame(p: Project, ids: string[], mode: 'cover' | 'contain'): Project {
  const { width: W, height: H } = p.settings;
  return mapTransform(p, ids, (t, c) => {
    if (c.type !== 'media') return t;
    const a = p.media[c.mediaId];
    if (!a || !(a.width > 0) || !(a.height > 0)) throw new TimelineError('Não sei o tamanho dessa mídia para ajustar ao quadro', 'INVALID');
    const contain = Math.min(W / a.width, H / a.height);
    const cover = Math.max(W / a.width, H / a.height);
    return { ...t, x: 0, y: 0, scale: mode === 'cover' ? round6(clamp(cover / contain, 0.01, 20)) : 1 };
  });
}

/** Corta a mídia, centrada, para a proporção largura/altura dada (por exemplo 1 para quadrado, 9/16 para vertical). */
export function cropToAspect(p: Project, ids: string[], aspect: number): Project {
  if (!(aspect > 0.1 && aspect < 10)) throw new TimelineError('Proporção fora do intervalo 1:10 a 10:1', 'OUT_OF_RANGE');
  return mapTransform(p, ids, (t, c) => {
    if (c.type !== 'media') return t;
    const a = p.media[c.mediaId];
    if (!a || !(a.width > 0) || !(a.height > 0)) throw new TimelineError('Não sei o tamanho dessa mídia para cortar', 'INVALID');
    const src = a.width / a.height;
    const crop = aspect < src ? { l: (1 - aspect / src) / 2, r: (1 - aspect / src) / 2, t: 0, b: 0 } : { l: 0, r: 0, t: (1 - src / aspect) / 2, b: (1 - src / aspect) / 2 };
    return { ...t, crop: { l: round6(crop.l), r: round6(crop.r), t: round6(crop.t), b: round6(crop.b) } };
  });
}

export interface KenBurnsOptions {
  /** Quanto a escala cresce (1,15 = 15%). Padrão 1,15. */
  zoom?: number;
  /** 'in' aproxima, 'out' afasta. Padrão 'in'. */
  direction?: 'in' | 'out';
  /** Desliza para um lado durante o movimento (fração do quadro). Padrão 0. */
  pan?: number;
}

/** Efeito Ken Burns: anima escala (e posição horizontal, se houver pan) do primeiro ao último instante do clipe. */
export function kenBurns(p: Project, ids: string[], opts: KenBurnsOptions = {}): Project {
  const zoom = opts.zoom ?? 1.15;
  const pan = opts.pan ?? 0;
  if (!(zoom > 1 && zoom <= 3)) throw new TimelineError('O zoom vai de 1,01 a 3', 'OUT_OF_RANGE');
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    const clip = requireClip(next, id).clip;
    if (!hasTransform(clip)) continue;
    const s0 = clip.transform.scale;
    const [from, to] = opts.direction === 'out' ? [s0 * zoom, s0] : [s0, s0 * zoom];
    const curves: Partial<Record<AnimatableProp, Keyframe[]>> = {
      scale: upsertKeyframe(upsertKeyframe([], 0, round6(clamp(from, 0.01, 20)), 'ease'), clip.duration, round6(clamp(to, 0.01, 20)), 'linear'),
    };
    if (pan) curves.x = upsertKeyframe(upsertKeyframe([], 0, clip.transform.x, 'ease'), clip.duration, round6(clip.transform.x + pan), 'linear');
    next = withKeyframes(next, id, curves);
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou texto', 'KIND_MISMATCH');
  return next;
}

/** "Soco" de zoom: a escala sobe para ${amount} × em ${at} (s desde o início do clipe) e volta ao valor original depois de ${length} s. */
export function punchIn(p: Project, id: string, at: number, amount = 1.25, length = 0.6): Project {
  const clip = requireClip(p, id).clip;
  if (!hasTransform(clip)) throw new TimelineError('Selecione um clipe de vídeo, imagem ou texto', 'KIND_MISMATCH');
  if (!(amount > 1) || !(length > 0.05)) throw new TimelineError('Valores do zoom inválidos', 'OUT_OF_RANGE');
  if (!(at >= 0) || at + length > clip.duration + 1e-6) throw new TimelineError('O zoom precisa caber dentro do clipe', 'OUT_OF_RANGE');
  const s0 = clip.transform.scale;
  let k = clip.keyframes.scale ?? [];
  k = upsertKeyframe(k, at, s0, 'ease');
  k = upsertKeyframe(k, at + length * 0.35, round6(clamp(s0 * amount, 0.01, 20)), 'ease');
  k = upsertKeyframe(k, at + length, s0, 'linear');
  return withKeyframes(p, id, { scale: k });
}

/** Tremor de câmera: keyframes de x/y a ${rate} por segundo, deslocando até ${amount} (fração do quadro). Começa e termina na posição original. */
export function shakeClips(p: Project, ids: string[], amount = 0.01, seed = 1, rate = 12): Project {
  if (!(amount > 0 && amount <= 0.2)) throw new TimelineError('A intensidade vai de 0 a 20% do quadro', 'OUT_OF_RANGE');
  if (!(rate >= 1 && rate <= 30)) throw new TimelineError('A frequência vai de 1 a 30 por segundo', 'OUT_OF_RANGE');
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    const clip = requireClip(next, id).clip;
    if (!hasTransform(clip)) continue;
    const rnd = mulberry32(seed + n * 977);
    const steps = Math.max(2, Math.round(clip.duration * rate));
    if (steps > 600) throw new TimelineError('Clipe longo demais para o tremor nessa frequência', 'OUT_OF_RANGE');
    let kx: Keyframe[] = [];
    let ky: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = round6((clip.duration * i) / steps);
      const edge = i === 0 || i === steps;
      kx = upsertKeyframe(kx, t, round6(clip.transform.x + (edge ? 0 : (rnd() * 2 - 1) * amount)), 'ease');
      ky = upsertKeyframe(ky, t, round6(clip.transform.y + (edge ? 0 : (rnd() * 2 - 1) * amount)), 'ease');
    }
    next = withKeyframes(next, id, { x: kx, y: ky });
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou texto', 'KIND_MISMATCH');
  return next;
}
