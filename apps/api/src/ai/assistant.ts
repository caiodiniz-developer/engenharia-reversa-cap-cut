import { z } from 'zod';
import {
  addClip,
  addTrack,
  createEffect,
  deleteClips,
  EFFECTS,
  findClip,
  MediaClipSchema,
  newId,
  projectDuration,
  removeRanges,
  setSpeed,
  setTransition,
  setSettings,
  splitClip,
  trimClip,
  TextClipSchema,
  TRANSITION_TYPES,
  updateClip,
  type Project,
} from '@editor/core';

/** Operações que o assistente pode propor. Cada uma é validada e executada pelas mesmas funções da timeline. */
export const AssistantOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('addClip'),
    mediaId: z.string(),
    /** Posição na timeline (s). Omitido = ao final da faixa. */
    start: z.number().min(0).optional(),
    sourceIn: z.number().min(0).default(0),
    duration: z.number().positive(),
    track: z.number().int().min(0).default(0),
  }),
  z.object({ op: z.literal('split'), clipId: z.string(), time: z.number().min(0) }),
  z.object({ op: z.literal('trim'), clipId: z.string(), edge: z.enum(['start', 'end']), time: z.number().min(0) }),
  z.object({ op: z.literal('delete'), clipIds: z.array(z.string()).min(1), ripple: z.boolean().default(true) }),
  z.object({ op: z.literal('removeRanges'), clipId: z.string(), ranges: z.array(z.object({ start: z.number(), end: z.number() })).min(1) }),
  z.object({ op: z.literal('setSpeed'), clipId: z.string(), speed: z.number() }),
  z.object({ op: z.literal('addText'), text: z.string().min(1).max(300), start: z.number().min(0), duration: z.number().positive(), y: z.number().min(-0.5).max(0.5).default(0) }),
  z.object({ op: z.literal('transition'), clipId: z.string(), type: z.enum(TRANSITION_TYPES), duration: z.number().positive() }),
  z.object({ op: z.literal('effect'), clipId: z.string(), type: z.string(), params: z.record(z.string(), z.number()).default({}) }),
  z.object({ op: z.literal('format'), width: z.number().int(), height: z.number().int(), fps: z.number().optional() }),
]);
export type AssistantOp = z.infer<typeof AssistantOpSchema>;

export const AssistantPlanSchema = z.object({
  summary: z.string().max(1000),
  ops: z.array(AssistantOpSchema).max(200),
});

export interface ApplyResult {
  project: Project;
  applied: number;
  errors: Array<{ index: number; op: string; message: string }>;
}

/** Executa as operações em sequência sobre uma cópia; operações inválidas são reportadas e ignoradas. */
export function applyAssistantOps(project: Project, ops: AssistantOp[]): ApplyResult {
  let p = project;
  let applied = 0;
  const errors: ApplyResult['errors'] = [];
  ops.forEach((op, index) => {
    try {
      p = applyOne(p, op);
      applied++;
    } catch (e) {
      errors.push({ index, op: op.op, message: e instanceof Error ? e.message : String(e) });
    }
  });
  return { project: p, applied, errors };
}

function applyOne(p: Project, op: AssistantOp): Project {
  switch (op.op) {
    case 'addClip': {
      const asset = p.media[op.mediaId];
      if (!asset) throw new Error(`Mídia ${op.mediaId} não existe no projeto`);
      const kind = asset.kind === 'audio' ? 'audio' : 'video';
      const tracks = p.tracks.filter((t) => t.kind === kind);
      let next = p;
      let track = tracks[op.track];
      if (!track) {
        const r = addTrack(next, kind);
        next = r.project;
        track = r.track;
      }
      const cur = next.tracks.find((t) => t.id === track!.id)!;
      const end = cur.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      const clip = MediaClipSchema.parse({ id: newId('clp'), type: 'media', mediaId: op.mediaId, start: op.start ?? end, sourceIn: op.sourceIn, duration: op.duration });
      return addClip(next, track.id, clip);
    }
    case 'split':
      return splitClip(p, op.clipId, op.time).project;
    case 'trim':
      return trimClip(p, op.clipId, op.edge, op.time);
    case 'delete':
      return deleteClips(p, op.clipIds, { ripple: op.ripple });
    case 'removeRanges':
      return removeRanges(p, op.clipId, op.ranges);
    case 'setSpeed':
      return setSpeed(p, op.clipId, op.speed);
    case 'addText': {
      let next = p;
      let track = next.tracks.find((t) => t.kind === 'text' && !t.locked);
      if (!track) {
        const r = addTrack(next, 'text');
        next = r.project;
        track = r.track;
      }
      const clip = TextClipSchema.parse({ id: newId('clp'), type: 'text', text: op.text, start: op.start, duration: op.duration, transform: { y: op.y } });
      return addClip(next, track.id, clip);
    }
    case 'transition':
      return setTransition(p, op.clipId, op.type, op.duration);
    case 'effect': {
      if (!EFFECTS.some((e) => e.type === op.type)) throw new Error(`Efeito desconhecido: ${op.type}`);
      if (!findClip(p, op.clipId)) throw new Error(`Clipe ${op.clipId} não encontrado`);
      return updateClip(p, op.clipId, (c) => (c.type === 'media' ? { ...c, effects: [...c.effects, createEffect(op.type, op.params)] } : c));
    }
    case 'format':
      return setSettings(p, { width: op.width, height: op.height, ...(op.fps ? { fps: op.fps } : {}) });
  }
}

/** Resumo compacto do projeto para o prompt do modelo (ids reais para que as operações sejam aplicáveis). */
export function describeProject(p: Project, transcripts: Record<string, string> = {}): string {
  const media = Object.values(p.media).map((m) => ({
    id: m.id,
    name: m.name,
    kind: m.kind,
    duration: Number(m.duration.toFixed(2)),
    size: `${m.width}x${m.height}`,
    transcript: transcripts[m.id]?.slice(0, 2500),
  }));
  const tracks = p.tracks.map((t) => ({
    kind: t.kind,
    clips: t.clips.map((c) => ({ id: c.id, type: c.type, start: c.start, duration: c.duration, ...(c.type === 'media' ? { mediaId: c.mediaId, sourceIn: c.sourceIn } : { text: c.text }) })),
  }));
  return JSON.stringify({ settings: p.settings, duration: projectDuration(p), media, tracks });
}

export const ASSISTANT_SYSTEM = `Você é o assistente de edição de um editor de vídeo web. Converta o pedido do usuário em uma lista de operações sobre a timeline.
Formato: {"summary": string, "ops": Operation[]}.
Operações disponíveis (campo "op"): addClip{mediaId,start?,sourceIn,duration,track?}, split{clipId,time}, trim{clipId,edge,time}, delete{clipIds,ripple}, removeRanges{clipId,ranges[{start,end}]}, setSpeed{clipId,speed}, addText{text,start,duration,y?}, transition{clipId,type,duration}, effect{clipId,type,params}, format{width,height,fps?}.
Regras: use apenas ids de mídia e de clipes presentes no contexto; tempos em segundos; trechos de origem (sourceIn+duration) devem caber na duração da mídia; não invente mídias; se o pedido não puder ser atendido com os dados disponíveis, devolva ops vazio e explique em "summary".
Para vídeo vertical use format 1080x1920. Efeitos válidos: ${EFFECTS.map((e) => e.type).join(', ')}.`;
