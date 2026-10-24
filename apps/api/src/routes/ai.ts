import { Router } from 'express';
import { z } from 'zod';
import { migrateProject } from '@editor/core';
import { applyAssistantOps, ASSISTANT_SYSTEM, AssistantPlanSchema, describeProject } from '../ai/assistant';
import { HttpError, h, json, notFound, ownedMedia, ownedProject, parse, requireAuth, type AppContext } from '../http';

const Transcribe = z.object({ mediaId: z.string(), language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/).optional() });
const Analyze = z.object({
  mediaId: z.string(),
  kind: z.enum(['silence', 'scenes', 'beats', 'cuts', 'highlights']),
  noiseDb: z.number().min(-90).max(-10).optional(),
  minDuration: z.number().min(0.1).max(30).optional(),
  threshold: z.number().min(0.05).max(0.95).optional(),
  targetSeconds: z.number().min(3).max(600).optional(),
});
const Assistant = z.object({ prompt: z.string().trim().min(3).max(2000) });
const TextTask = z.object({ transcript: z.string().min(10).max(60_000) });

export function aiRoutes(ctx: AppContext): Router {
  const r = Router();
  const auth = requireAuth(ctx.config);

  /** Limita chamadas de IA por usuário/dia (controle de custos). */
  async function enforceBudget(userId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 3600_000);
    const used = await ctx.db.job.count({ where: { ownerId: userId, type: { in: ['ai.transcribe', 'ai.assistant'] }, createdAt: { gte: since } } });
    if (used >= ctx.config.AI_DAILY_CALL_LIMIT) {
      throw new HttpError(429, `Limite diário de ${ctx.config.AI_DAILY_CALL_LIMIT} chamadas de IA atingido`, 'ai_budget');
    }
  }

  async function mediaOfProject(projectId: string, mediaId: string, userId: string) {
    const m = await ownedMedia(ctx, mediaId, userId);
    if (m.projectId !== projectId) throw notFound('Mídia');
    if (m.status !== 'ready') throw new HttpError(409, 'A mídia ainda está sendo processada', 'media_not_ready');
    return m;
  }

  r.get(
    '/ai/capabilities',
    auth,
    h(async (_req, res) => {
      res.json({
        transcription: ctx.ai.transcriptionProvider(),
        assistant: ctx.ai.llmAvailable(),
        // Provedor externo = o áudio é enviado a terceiros; o cliente deve pedir consentimento.
        transcriptionSendsDataExternally: ctx.ai.transcriptionProvider() === 'openai',
        assistantSendsDataExternally: ctx.ai.llmAvailable(),
        local: ['silence', 'scenes', 'beats', 'cuts', 'highlights'],
        unsupported: ['background-removal', 'vocal-isolation'],
      });
    }),
  );

  r.post(
    '/projects/:id/ai/transcribe',
    auth,
    h(async (req, res) => {
      const body = parse(Transcribe, req.body);
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      ctx.ai.requireTranscription();
      const media = await mediaOfProject(p.id, body.mediaId, req.userId);
      if (!media.hasAudio) throw new HttpError(422, 'A mídia não tem áudio', 'no_audio');
      await enforceBudget(req.userId);
      const job = await ctx.queue.enqueue({ type: 'ai.transcribe', ownerId: req.userId, projectId: p.id, payload: body });
      res.status(202).json({ jobId: job.id });
    }),
  );

  r.post(
    '/projects/:id/ai/analyze',
    auth,
    h(async (req, res) => {
      const body = parse(Analyze, req.body);
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      await mediaOfProject(p.id, body.mediaId, req.userId);
      const job = await ctx.queue.enqueue({ type: 'ai.analyze', ownerId: req.userId, projectId: p.id, payload: body });
      res.status(202).json({ jobId: job.id });
    }),
  );

  /** Resumo e títulos a partir de um texto (transcrição) — exigem o provedor de LLM. */
  for (const task of ['summarize', 'titles'] as const) {
    r.post(
      `/projects/:id/ai/${task}`,
      h(async (req, res) => {
        const body = parse(TextTask, req.body);
        await ownedProject(ctx, req.params.id!, req.userId);
        ctx.ai.requireLlm();
        await enforceBudget(req.userId);
        const schema = task === 'summarize' ? z.object({ summary: z.string(), bullets: z.array(z.string()).max(10) }) : z.object({ titles: z.array(z.string()).min(1).max(8) });
        const system =
          task === 'summarize'
            ? 'Resuma o conteúdo da transcrição em português. Formato: {"summary": string, "bullets": string[]}.'
            : 'Sugira títulos curtos e chamativos (até 60 caracteres) para o vídeo, no idioma da transcrição. Formato: {"titles": string[]}.';
        const result = await ctx.ai.llmJson(system, body.transcript, schema);
        // Registra a chamada para o controle de orçamento diário.
        await ctx.db.job.create({ data: { type: 'ai.assistant', ownerId: req.userId, projectId: req.params.id!, status: 'succeeded', progress: 1, finishedAt: new Date(), payload: { task } } });
        res.json(result);
      }),
    );
  }

  /**
   * Assistente de edição por linguagem natural. Devolve uma PROPOSTA: as operações validadas e o projeto
   * resultante, para o usuário revisar e aplicar na timeline (com undo). Nada é gravado aqui.
   */
  r.post(
    '/projects/:id/ai/assistant',
    auth,
    h(async (req, res) => {
      const body = parse(Assistant, req.body);
      const p = await ownedProject(ctx, req.params.id!, req.userId);
      ctx.ai.requireLlm();
      await enforceBudget(req.userId);
      const project = migrateProject(p.data);

      // Contexto: transcrições já geradas para as mídias do projeto.
      const done = await ctx.db.job.findMany({ where: { projectId: p.id, type: 'ai.transcribe', status: 'succeeded' }, orderBy: { createdAt: 'desc' }, take: 20 });
      const transcripts: Record<string, string> = {};
      for (const j of done) {
        const rr = j.result as { mediaId?: string; text?: string } | null;
        if (rr?.mediaId && rr.text && !transcripts[rr.mediaId]) transcripts[rr.mediaId] = rr.text;
      }

      const plan = await ctx.ai.llmJson(ASSISTANT_SYSTEM, `Projeto:\n${describeProject(project, transcripts)}\n\nPedido do usuário: ${body.prompt}`, AssistantPlanSchema);
      const result = applyAssistantOps(project, plan.ops);
      await ctx.db.job.create({ data: { type: 'ai.assistant', ownerId: req.userId, projectId: p.id, status: 'succeeded', progress: 1, finishedAt: new Date(), payload: { prompt: body.prompt } } });
      res.json(json({ summary: plan.summary, ops: plan.ops, applied: result.applied, errors: result.errors, project: result.project, baseRevision: p.revision }));
    }),
  );

  return r;
}
