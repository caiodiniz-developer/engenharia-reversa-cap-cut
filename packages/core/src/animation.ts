import { round6 } from './time';
import type { AnimatableProp, Clip, Easing, Keyframe, Keyframes, Transform } from './schema';

/**
 * Animações prontas: conjuntos de keyframes (e, às vezes, um ajuste fixo de transformação) calculados
 * para o clipe. Como são só keyframes comuns, o preview e a exportação já sabem reproduzi-los.
 */

export type AnimationKind = 'in' | 'out' | 'whole';

export interface AnimationPreset {
  id: string;
  label: string;
  kind: AnimationKind;
  description: string;
  /** Duração padrão (s) para entrada/saída; ignorada nas animações de clipe inteiro. */
  defaultDuration: number;
  /** Propriedades que a animação controla. */
  props: AnimatableProp[];
  build(opts: { clipDuration: number; duration: number }): { keyframes: Keyframes; transform?: Partial<Transform> };
}

const kf = (time: number, value: number, easing: Easing = 'ease'): Keyframe => ({ time: round6(time), value, easing });

/** Entrada: do valor `from` ao `to` nos primeiros `d` segundos. */
function enter(prop: AnimatableProp, from: number, to: number) {
  return (o: { duration: number }): Keyframes => ({ [prop]: [kf(0, from), kf(o.duration, to, 'linear')] });
}

/** Saída: do `from` ao `to` nos últimos `d` segundos. */
function leave(prop: AnimatableProp, from: number, to: number) {
  return (o: { clipDuration: number; duration: number }): Keyframes => ({ [prop]: [kf(o.clipDuration - o.duration, from), kf(o.clipDuration, to, 'linear')] });
}

const merge = (...parts: Keyframes[]): Keyframes => Object.assign({}, ...parts);

export const ANIMATION_PRESETS: AnimationPreset[] = [
  // ---- Entrada ----
  { id: 'fade-in', label: 'Aparecer', kind: 'in', description: 'Surge gradualmente', defaultDuration: 0.6, props: ['opacity'], build: (o) => ({ keyframes: enter('opacity', 0, 1)(o) }) },
  { id: 'zoom-in', label: 'Zoom de entrada', kind: 'in', description: 'Cresce a partir de 60% com fade', defaultDuration: 0.6, props: ['scale', 'opacity'], build: (o) => ({ keyframes: merge(enter('scale', 0.6, 1)(o), enter('opacity', 0, 1)(o)) }) },
  { id: 'zoom-out-in', label: 'Zoom para dentro', kind: 'in', description: 'Começa grande e assenta', defaultDuration: 0.6, props: ['scale', 'opacity'], build: (o) => ({ keyframes: merge(enter('scale', 1.4, 1)(o), enter('opacity', 0, 1)(o)) }) },
  { id: 'slide-in-left', label: 'Entra pela direita', kind: 'in', description: 'Desliza da direita para o centro', defaultDuration: 0.6, props: ['x'], build: (o) => ({ keyframes: enter('x', 0.5, 0)(o) }) },
  { id: 'slide-in-right', label: 'Entra pela esquerda', kind: 'in', description: 'Desliza da esquerda para o centro', defaultDuration: 0.6, props: ['x'], build: (o) => ({ keyframes: enter('x', -0.5, 0)(o) }) },
  { id: 'slide-in-up', label: 'Sobe', kind: 'in', description: 'Sobe de baixo para o centro', defaultDuration: 0.6, props: ['y'], build: (o) => ({ keyframes: enter('y', 0.5, 0)(o) }) },
  { id: 'slide-in-down', label: 'Desce', kind: 'in', description: 'Desce de cima para o centro', defaultDuration: 0.6, props: ['y'], build: (o) => ({ keyframes: enter('y', -0.5, 0)(o) }) },
  {
    id: 'pop',
    label: 'Pop',
    kind: 'in',
    description: 'Cresce, passa do ponto e assenta',
    defaultDuration: 0.5,
    props: ['scale', 'opacity'],
    build: (o) => ({ keyframes: { scale: [kf(0, 0.2), kf(o.duration * 0.65, 1.12), kf(o.duration, 1, 'linear')], opacity: [kf(0, 0), kf(o.duration * 0.4, 1, 'linear')] } }),
  },
  { id: 'spin-in', label: 'Giro de entrada', kind: 'in', description: 'Gira meia volta enquanto aparece', defaultDuration: 0.7, props: ['rotation', 'scale', 'opacity'], build: (o) => ({ keyframes: merge(enter('rotation', -180, 0)(o), enter('scale', 0.5, 1)(o), enter('opacity', 0, 1)(o)) }) },

  // ---- Saída ----
  { id: 'fade-out', label: 'Desaparecer', kind: 'out', description: 'Some gradualmente', defaultDuration: 0.6, props: ['opacity'], build: (o) => ({ keyframes: leave('opacity', 1, 0)(o) }) },
  { id: 'zoom-out', label: 'Zoom de saída', kind: 'out', description: 'Encolhe com fade', defaultDuration: 0.6, props: ['scale', 'opacity'], build: (o) => ({ keyframes: merge(leave('scale', 1, 0.6)(o), leave('opacity', 1, 0)(o)) }) },
  { id: 'slide-out-left', label: 'Sai pela esquerda', kind: 'out', description: 'Desliza para fora à esquerda', defaultDuration: 0.6, props: ['x'], build: (o) => ({ keyframes: leave('x', 0, -0.5)(o) }) },
  { id: 'slide-out-right', label: 'Sai pela direita', kind: 'out', description: 'Desliza para fora à direita', defaultDuration: 0.6, props: ['x'], build: (o) => ({ keyframes: leave('x', 0, 0.5)(o) }) },
  { id: 'slide-out-down', label: 'Desce e sai', kind: 'out', description: 'Desliza para baixo', defaultDuration: 0.6, props: ['y'], build: (o) => ({ keyframes: leave('y', 0, 0.5)(o) }) },

  // ---- Clipe inteiro (movimento e ênfase) ----
  {
    id: 'ken-burns-in',
    label: 'Ken Burns: aproximar',
    kind: 'whole',
    description: 'Zoom lento de 100% a 120% durante o clipe',
    defaultDuration: 0,
    props: ['scale'],
    build: (o) => ({ keyframes: { scale: [kf(0, 1), kf(o.clipDuration, 1.2)] } }),
  },
  {
    id: 'ken-burns-out',
    label: 'Ken Burns: afastar',
    kind: 'whole',
    description: 'Zoom lento de 120% a 100% durante o clipe',
    defaultDuration: 0,
    props: ['scale'],
    build: (o) => ({ keyframes: { scale: [kf(0, 1.2), kf(o.clipDuration, 1)] } }),
  },
  {
    id: 'pan-left',
    label: 'Panorâmica para a esquerda',
    kind: 'whole',
    description: 'Câmera desliza para a esquerda (escala 115%)',
    defaultDuration: 0,
    props: ['x'],
    build: (o) => ({ transform: { scale: 1.15 }, keyframes: { x: [kf(0, 0.06, 'linear'), kf(o.clipDuration, -0.06, 'linear')] } }),
  },
  {
    id: 'pan-right',
    label: 'Panorâmica para a direita',
    kind: 'whole',
    description: 'Câmera desliza para a direita (escala 115%)',
    defaultDuration: 0,
    props: ['x'],
    build: (o) => ({ transform: { scale: 1.15 }, keyframes: { x: [kf(0, -0.06, 'linear'), kf(o.clipDuration, 0.06, 'linear')] } }),
  },
  {
    id: 'pulse',
    label: 'Pulsar',
    kind: 'whole',
    description: 'Bate suavemente a cada segundo',
    defaultDuration: 0,
    props: ['scale'],
    build: (o) => {
      const beats: Keyframe[] = [];
      for (let t = 0; t < o.clipDuration; t += 1) {
        beats.push(kf(t, 1), kf(Math.min(o.clipDuration, t + 0.5), 1.08));
      }
      beats.push(kf(o.clipDuration, 1));
      return { keyframes: { scale: beats } };
    },
  },
  {
    id: 'shake',
    label: 'Tremer',
    kind: 'whole',
    description: 'Vibração rápida de câmera',
    defaultDuration: 0,
    props: ['x', 'y', 'rotation'],
    build: (o) => {
      const step = 0.06;
      const xs: Keyframe[] = [];
      const ys: Keyframes['y'] = [];
      const rs: Keyframe[] = [];
      // Sequência pseudoaleatória determinística (mesmo clipe → mesma vibração, sem Math.random).
      let seed = 7;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
      for (let t = 0; t <= o.clipDuration + 1e-9; t += step) {
        xs.push(kf(t, round6(rnd() * 0.012), 'linear'));
        ys.push(kf(t, round6(rnd() * 0.012), 'linear'));
        rs.push(kf(t, round6(rnd() * 1.2), 'linear'));
      }
      return { transform: { scale: 1.05 }, keyframes: { x: xs, y: ys, rotation: rs } };
    },
  },
  { id: 'float', label: 'Flutuar', kind: 'whole', description: 'Sobe e desce devagar', defaultDuration: 0, props: ['y'], build: (o) => {
    const pts: Keyframe[] = [];
    for (let t = 0; t <= o.clipDuration + 1e-9; t += 1) pts.push(kf(t, (Math.round(t) % 2 === 0 ? -1 : 1) * 0.015));
    return { keyframes: { y: pts } };
  } },
];

export const getAnimationPreset = (id: string): AnimationPreset | undefined => ANIMATION_PRESETS.find((p) => p.id === id);

/** Troca os keyframes dentro de [from, to] preservando o que está fora (permite combinar entrada + saída). */
function mergeWindow(existing: Keyframe[] | undefined, added: Keyframe[], from: number, to: number): Keyframe[] {
  const eps = 1e-6;
  const kept = (existing ?? []).filter((k) => k.time < from - eps || k.time > to + eps);
  return [...kept, ...added].sort((a, b) => a.time - b.time);
}

/**
 * Aplica uma animação a um clipe. Entrada e saída podem coexistir; "clipe inteiro" substitui as propriedades
 * que controla. Devolve o clipe novo (não altera o original).
 */
export function applyAnimation<C extends Clip>(clip: C, presetId: string, duration?: number): C {
  const preset = getAnimationPreset(presetId);
  if (!preset) throw new Error(`Animação desconhecida: ${presetId}`);
  const d = Math.min(Math.max(0.1, duration ?? preset.defaultDuration), Math.max(0.1, clip.duration / 2));
  const built = preset.build({ clipDuration: clip.duration, duration: d });
  const [from, to] = preset.kind === 'in' ? [0, d] : preset.kind === 'out' ? [clip.duration - d, clip.duration] : [0, clip.duration];
  const keyframes: Keyframes = { ...clip.keyframes };
  for (const prop of Object.keys(built.keyframes) as AnimatableProp[]) {
    keyframes[prop] = mergeWindow(preset.kind === 'whole' ? undefined : clip.keyframes[prop], built.keyframes[prop] ?? [], from, to);
  }
  const base = clip as unknown as { transform?: Transform };
  return {
    ...clip,
    keyframes,
    ...(built.transform && base.transform ? { transform: { ...base.transform, ...built.transform } } : {}),
  };
}

/** Remove todos os keyframes do clipe. */
export function clearAnimations<C extends Clip>(clip: C): C {
  return { ...clip, keyframes: {} };
}
