import { TimelineError } from '../errors';
import { upsertKeyframe } from '../keyframes';
import type { AudioProps, Clip, Keyframe, MediaClip, Project } from '../schema';
import { clipEnd, round6 } from '../time';
import { updateClip } from './clips';
import { requireClip } from './helpers';

const isMedia = (c: Clip): c is MediaClip => c.type === 'media';

/** Aplica fn a cada clipe de mídia dentre os ids (os demais são ignorados); falha se nenhum for de mídia. */
export function mapMediaClips(p: Project, ids: string[], fn: (c: MediaClip) => MediaClip): Project {
  let next = p;
  let n = 0;
  for (const id of new Set(ids)) {
    if (!isMedia(requireClip(next, id).clip)) continue;
    next = updateClip(next, id, (c) => fn(c as MediaClip));
    n++;
  }
  if (!n) throw new TimelineError('Selecione clipes de vídeo, imagem ou áudio', 'KIND_MISMATCH');
  return next;
}

const withAudio = (c: MediaClip, patch: Partial<AudioProps>): MediaClip => ({ ...c, audio: { ...c.audio, ...patch } });

/** Define o volume (0 a 4, onde 1 = 100%) de todos os clipes escolhidos. */
export function setVolume(p: Project, ids: string[], volume: number): Project {
  if (!(volume >= 0 && volume <= 4)) throw new TimelineError('O volume vai de 0% a 400%', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => withAudio(c, { volume: round6(volume) }));
}

/** Soma ganho em dB ao volume de cada clipe (+6 dB dobra, -6 dB divide por dois), limitado a 0–400%. */
export function adjustVolumeDb(p: Project, ids: string[], db: number): Project {
  if (!Number.isFinite(db)) throw new TimelineError('Informe o ganho em dB', 'INVALID');
  const gain = Math.pow(10, db / 20);
  return mapMediaClips(p, ids, (c) => withAudio(c, { volume: round6(Math.min(4, Math.max(0, c.audio.volume * gain))) }));
}

/** Silencia (ou reativa) o som dos clipes escolhidos. */
export function setMuted(p: Project, ids: string[], muted: boolean): Project {
  return mapMediaClips(p, ids, (c) => withAudio(c, { muted }));
}

/** Define fade de entrada e de saída (segundos). Se somarem mais que o clipe, os dois encolhem na mesma proporção. */
export function setFades(p: Project, ids: string[], fadeIn: number, fadeOut: number): Project {
  if (!(fadeIn >= 0) || !(fadeOut >= 0)) throw new TimelineError('Os fades não podem ser negativos', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => {
    const total = fadeIn + fadeOut;
    const k = total > c.duration ? c.duration / total : 1;
    return withAudio(c, { fadeIn: round6(fadeIn * k), fadeOut: round6(fadeOut * k) });
  });
}

/** Define o balanço: -1 = só esquerdo, 0 = centro, 1 = só direito. */
export function setPan(p: Project, ids: string[], pan: number): Project {
  if (!(pan >= -1 && pan <= 1)) throw new TimelineError('O balanço vai de -1 (esquerda) a 1 (direita)', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => withAudio(c, { pan: round6(pan) }));
}

/** Ajusta as bandas do equalizador (dB, -24 a 24); as bandas não informadas continuam como estavam. */
export function setEq(p: Project, ids: string[], bands: Partial<AudioProps['eq']>): Project {
  for (const v of Object.values(bands)) if (v !== undefined && !(v >= -24 && v <= 24)) throw new TimelineError('O equalizador vai de -24 a 24 dB', 'OUT_OF_RANGE');
  return mapMediaClips(p, ids, (c) => withAudio(c, { eq: { ...c.audio.eq, ...bands } }));
}

/** Liga ou desliga a normalização de volume e a redução de ruído; o que não for informado não muda. */
export function setAudioFlags(p: Project, ids: string[], flags: { normalize?: boolean; denoise?: boolean }): Project {
  return mapMediaClips(p, ids, (c) =>
    withAudio(c, {
      normalize: flags.normalize ?? c.audio.normalize,
      denoise: flags.denoise ?? c.audio.denoise,
    }),
  );
}

export interface DuckOptions {
  /** Fração do volume mantida durante a voz (0 a 1). Padrão 0,25. */
  amount?: number;
  /** Segundos para descer e para voltar. Padrão 0,3. */
  ramp?: number;
}

/**
 * Cria keyframes de volume nos clipes de música: o volume desce para ${amount} × o volume base enquanto algum clipe da voz
 * estiver tocando e volta depois, com rampas suaves. Trechos de voz próximos são fundidos para não "pulsar".
 * Substitui keyframes de volume existentes nesses clipes. Devolve também quantos clipes receberam rebaixamento.
 */
export function duckUnder(p: Project, musicIds: string[], voiceIds: string[], opts: DuckOptions = {}): { project: Project; ducked: number } {
  const amount = opts.amount ?? 0.25;
  const ramp = opts.ramp ?? 0.3;
  if (!(amount >= 0 && amount <= 1)) throw new TimelineError('O rebaixamento vai de 0% a 100%', 'OUT_OF_RANGE');
  if (!(ramp > 0)) throw new TimelineError('A rampa precisa ser maior que zero', 'OUT_OF_RANGE');
  const voices = [...new Set(voiceIds)].map((id) => requireClip(p, id).clip);
  if (!voices.length) throw new TimelineError('Escolha ao menos um clipe de voz', 'KIND_MISMATCH');
  let next = p;
  let ducked = 0;
  for (const id of new Set(musicIds)) {
    const m = requireClip(next, id).clip;
    if (!isMedia(m) || voices.some((v) => v.id === id)) continue;
    const base = m.audio.volume;
    const local = voices
      .filter((v) => v.start < clipEnd(m) && clipEnd(v) > m.start)
      .map((v) => [Math.max(0, v.start - m.start), Math.min(m.duration, clipEnd(v) - m.start)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    if (!local.length) continue;
    const merged: Array<[number, number]> = [];
    for (const iv of local) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + 2 * ramp) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }
    let kfs: Keyframe[] = [];
    const low = round6(base * amount);
    for (const [a, b] of merged) {
      if (a - ramp > 0) kfs = upsertKeyframe(kfs, a - ramp, base, 'ease');
      kfs = upsertKeyframe(kfs, a, low, 'linear');
      kfs = upsertKeyframe(kfs, b, low, 'ease');
      if (b + ramp < m.duration) kfs = upsertKeyframe(kfs, b + ramp, base, 'linear');
    }
    next = updateClip(next, id, (c) => ({ ...c, keyframes: { ...c.keyframes, volume: kfs } }) as Clip);
    ducked++;
  }
  return { project: next, ducked };
}
