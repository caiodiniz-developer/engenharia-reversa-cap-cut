import { z } from 'zod';

/** Versão atual do formato de projeto. Incrementar ao alterar o schema e registrar migração em migrate.ts. */
export const SCHEMA_VERSION = 1;

const num = z.number().finite();

export const EasingSchema = z.enum(['linear', 'ease', 'hold']);
export type Easing = z.infer<typeof EasingSchema>;

export const KeyframeSchema = z.object({
  /** Tempo em segundos relativo ao início do clipe. */
  time: num.min(0),
  value: num,
  easing: EasingSchema.default('linear'),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const ANIMATABLE_PROPS = ['x', 'y', 'scale', 'rotation', 'opacity', 'volume'] as const;
export type AnimatableProp = (typeof ANIMATABLE_PROPS)[number];

export const KeyframesSchema = z
  .object({
    x: z.array(KeyframeSchema).optional(),
    y: z.array(KeyframeSchema).optional(),
    scale: z.array(KeyframeSchema).optional(),
    rotation: z.array(KeyframeSchema).optional(),
    opacity: z.array(KeyframeSchema).optional(),
    volume: z.array(KeyframeSchema).optional(),
  })
  .default({});
export type Keyframes = z.infer<typeof KeyframesSchema>;

export const CropSchema = z.object({
  l: num.min(0).max(0.95).default(0),
  t: num.min(0).max(0.95).default(0),
  r: num.min(0).max(0.95).default(0),
  b: num.min(0).max(0.95).default(0),
});
export type Crop = z.infer<typeof CropSchema>;

export const TransformSchema = z.object({
  /** Deslocamento horizontal como fração da largura do quadro (0 = centro). */
  x: num.default(0),
  /** Deslocamento vertical como fração da altura do quadro (0 = centro). */
  y: num.default(0),
  /** Multiplicador sobre o tamanho "contain" da mídia. */
  scale: num.min(0.01).max(20).default(1),
  /** Graus, sentido horário. */
  rotation: num.default(0),
  opacity: num.min(0).max(1).default(1),
  flipH: z.boolean().default(false),
  flipV: z.boolean().default(false),
  crop: CropSchema.default({}),
});
export type Transform = z.infer<typeof TransformSchema>;

export const EffectInstanceSchema = z.object({
  id: z.string(),
  type: z.string(),
  enabled: z.boolean().default(true),
  params: z.record(z.string(), num).default({}),
});
export type EffectInstance = z.infer<typeof EffectInstanceSchema>;

export const TRANSITION_TYPES = [
  'fade',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'wipe-left',
  'wipe-right',
] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const TransitionSchema = z.object({
  type: z.enum(TRANSITION_TYPES),
  duration: num.positive(),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const MaskSchema = z.object({
  shape: z.enum(['rect', 'ellipse']),
  /** Centro e tamanho como fração do clipe (0..1). */
  cx: num.default(0.5),
  cy: num.default(0.5),
  w: num.min(0.01).max(1).default(0.8),
  h: num.min(0.01).max(1).default(0.8),
  invert: z.boolean().default(false),
});
export type Mask = z.infer<typeof MaskSchema>;

export const AudioPropsSchema = z.object({
  volume: num.min(0).max(4).default(1),
  muted: z.boolean().default(false),
  fadeIn: num.min(0).default(0),
  fadeOut: num.min(0).default(0),
  normalize: z.boolean().default(false),
  denoise: z.boolean().default(false),
  /** Ganhos em dB. */
  eq: z
    .object({
      bass: num.min(-24).max(24).default(0),
      mid: num.min(-24).max(24).default(0),
      treble: num.min(-24).max(24).default(0),
    })
    .default({}),
  /** -1 = só esquerdo, 0 = estéreo, 1 = só direito. */
  pan: num.min(-1).max(1).default(0),
});
export type AudioProps = z.infer<typeof AudioPropsSchema>;

const clipBase = {
  id: z.string(),
  start: num.min(0),
  duration: num.positive(),
  /** Clipes com o mesmo linkId (vídeo + áudio extraído) se movem e cortam juntos. */
  linkId: z.string().optional(),
  /** Clipes agrupados pelo usuário. */
  groupId: z.string().optional(),
  keyframes: KeyframesSchema,
};

export const MediaClipSchema = z.object({
  ...clipBase,
  type: z.literal('media'),
  mediaId: z.string(),
  /** Ponto de entrada na mídia de origem, em segundos. */
  sourceIn: num.min(0).default(0),
  speed: num.min(0.1).max(16).default(1),
  reverse: z.boolean().default(false),
  /** Quando true, exibe apenas o quadro em sourceIn durante toda a duração. */
  freeze: z.boolean().default(false),
  transform: TransformSchema.default({}),
  audio: AudioPropsSchema.default({}),
  effects: z.array(EffectInstanceSchema).default([]),
  mask: MaskSchema.optional(),
  transitionIn: TransitionSchema.optional(),
});
export type MediaClip = z.infer<typeof MediaClipSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().default('Arial'),
  /** Tamanho em pixels para um quadro de 1080 px de altura; escala com a altura do projeto. */
  fontSize: num.min(4).max(1000).default(72),
  color: z.string().default('#ffffff'),
  /** Se definido, o preenchimento vira um degradê vertical color -> gradientTo. */
  gradientTo: z.string().optional(),
  bold: z.boolean().default(true),
  italic: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right']).default('center'),
  strokeColor: z.string().default('#000000'),
  strokeWidth: num.min(0).max(100).default(0),
  shadowColor: z.string().default('#000000'),
  shadowBlur: num.min(0).max(100).default(0),
  shadowX: num.default(0),
  shadowY: num.default(0),
  background: z.string().optional(),
  /** Largura máxima do bloco de texto como fração da largura do quadro. */
  maxWidth: num.min(0.1).max(1).default(0.9),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TEXT_ANIMATIONS = ['none', 'fade', 'slide-up', 'slide-down', 'pop'] as const;
export type TextAnimationType = (typeof TEXT_ANIMATIONS)[number];

export const TextAnimationSchema = z.object({
  type: z.enum(TEXT_ANIMATIONS),
  duration: num.min(0).default(0.4),
});
export type TextAnimation = z.infer<typeof TextAnimationSchema>;

export const TextClipSchema = z.object({
  ...clipBase,
  type: z.literal('text'),
  text: z.string(),
  style: TextStyleSchema.default({}),
  transform: TransformSchema.default({ y: 0 }),
  animationIn: TextAnimationSchema.default({ type: 'none', duration: 0.4 }),
  animationOut: TextAnimationSchema.default({ type: 'none', duration: 0.4 }),
});
export type TextClip = z.infer<typeof TextClipSchema>;

export const CaptionWordSchema = z.object({
  text: z.string(),
  /** Segundos relativos ao início do clipe. */
  start: num.min(0),
  end: num.min(0),
});
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

export const CaptionClipSchema = z.object({
  ...clipBase,
  type: z.literal('caption'),
  text: z.string(),
  words: z.array(CaptionWordSchema).default([]),
  style: TextStyleSchema.default({ fontSize: 56 }),
  /** Cor de destaque da palavra falada (requer words). */
  highlightColor: z.string().optional(),
  transform: TransformSchema.default({ y: 0.32 }),
  animationIn: TextAnimationSchema.default({ type: 'none', duration: 0.2 }),
  animationOut: TextAnimationSchema.default({ type: 'none', duration: 0.2 }),
});
export type CaptionClip = z.infer<typeof CaptionClipSchema>;

export const ClipSchema = z.discriminatedUnion('type', [
  MediaClipSchema,
  TextClipSchema,
  CaptionClipSchema,
]);
export type Clip = z.infer<typeof ClipSchema>;

export const TRACK_KINDS = ['video', 'audio', 'text', 'caption'] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export const TrackSchema = z.object({
  id: z.string(),
  kind: z.enum(TRACK_KINDS),
  name: z.string(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  muted: z.boolean().default(false),
  clips: z.array(ClipSchema).default([]),
});
export type Track = z.infer<typeof TrackSchema>;

export const MediaAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['video', 'audio', 'image']),
  /** Duração em segundos (imagens: 0). */
  duration: num.min(0),
  width: z.number().int().min(0).default(0),
  height: z.number().int().min(0).default(0),
  fps: num.min(0).default(0),
  hasAudio: z.boolean().default(false),
  size: z.number().int().min(0).default(0),
  mime: z.string().default(''),
  /** Id do arquivo no servidor (quando enviado). */
  serverId: z.string().optional(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MarkerSchema = z.object({
  id: z.string(),
  time: num.min(0),
  label: z.string().default(''),
  color: z.string().default('#f5a524'),
});
export type Marker = z.infer<typeof MarkerSchema>;

export const ProjectSettingsSchema = z.object({
  width: z.number().int().min(16).max(7680).default(1920),
  height: z.number().int().min(16).max(7680).default(1080),
  fps: num.min(1).max(120).default(30),
  sampleRate: z.number().int().default(48000),
  background: z.string().default('#000000'),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const ProjectSchema = z.object({
  version: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  settings: ProjectSettingsSchema.default({}),
  media: z.record(z.string(), MediaAssetSchema).default({}),
  tracks: z.array(TrackSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
});
export type Project = z.infer<typeof ProjectSchema>;
