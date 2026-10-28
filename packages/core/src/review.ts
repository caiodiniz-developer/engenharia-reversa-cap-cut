import { contrastRatio } from './color';
import { shownFraction } from './layout';
import { getPlatform, isInsideSafe, matchesAspect } from './platforms';
import { fastCaptionIds } from './ops/captions';
import { projectDuration } from './project';
import type { Clip, Project, Track } from './schema';
import { clipEnd, round6 } from './time';
import { unusedMediaIds } from './usage';

export type Severity = 'erro' | 'aviso' | 'dica';

export type RuleId =
  | 'gap'
  | 'late-start'
  | 'short-clip'
  | 'caption-fast'
  | 'caption-overlap'
  | 'no-captions'
  | 'upscale'
  | 'loud'
  | 'text-unsafe'
  | 'text-contrast'
  | 'unused-media'
  | 'empty-track'
  | 'hidden-has-clips'
  | 'too-long'
  | 'aspect';

export type FixKind = 'close-gaps' | 'set-platform-format' | 'remove-track' | 'show-track';

export interface ReviewIssue {
  /** Único dentro de uma revisão: regra + alvo. */
  id: string;
  rule: RuleId;
  severity: Severity;
  message: string;
  /** Instante da timeline para "ir até" (segundos). */
  time?: number;
  clipIds?: string[];
  trackId?: string;
  fix?: { kind: FixKind; label: string };
}

export interface ReviewOptions {
  platformId?: string;
  /** Ids da biblioteca (para achar mídias sem uso). Sem isso a regra de mídias não usadas é pulada. */
  libraryIds?: string[];
}

export const RULE_TITLE: Record<RuleId, string> = {
  gap: 'Espaços vazios',
  'late-start': 'Início sem imagem',
  'short-clip': 'Clipes muito curtos',
  'caption-fast': 'Legendas rápidas demais',
  'caption-overlap': 'Legendas sobrepostas',
  'no-captions': 'Sem legendas',
  upscale: 'Mídia ampliada além da resolução',
  loud: 'Volume muito alto',
  'text-unsafe': 'Texto fora da zona segura',
  'text-contrast': 'Contraste baixo no texto',
  'unused-media': 'Mídias não usadas',
  'empty-track': 'Faixas vazias',
  'hidden-has-clips': 'Faixa oculta com clipes',
  'too-long': 'Duração acima da recomendada',
  aspect: 'Formato diferente da plataforma',
};

const GAP_MIN = 0.5;
const SHORT_CLIP = 0.3;
const UPSCALE_WARN = 1.25;
const UPSCALE_ERROR = 2;
const LOUD_WARN = 1.5;
const LOUD_ERROR = 3;
const CONTRAST_MIN = 3;

const fmt = (t: number): string => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

const isVisualMedia = (p: Project, c: Clip, t: Track): boolean => c.type === 'media' && t.kind === 'video' && !t.hidden && p.media[c.mediaId]?.kind !== 'audio';

function gapIssues(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const t of p.tracks) {
    if (t.kind !== 'video' || t.locked) continue;
    const sorted = [...t.clips].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const gap = round6(sorted[i]!.start - clipEnd(sorted[i - 1]!));
      if (gap >= GAP_MIN) {
        out.push({ id: `gap:${t.id}:${sorted[i]!.id}`, rule: 'gap', severity: 'aviso', message: `Espaço vazio de ${gap.toFixed(1)} s em "${t.name}" (a partir de ${fmt(clipEnd(sorted[i - 1]!))})`, time: clipEnd(sorted[i - 1]!), trackId: t.id, fix: { kind: 'close-gaps', label: 'Fechar espaços da faixa' } });
      }
    }
  }
  return out;
}

function lateStart(p: Project): ReviewIssue[] {
  const starts: number[] = [];
  for (const t of p.tracks) for (const c of t.clips) if (isVisualMedia(p, c, t)) starts.push(c.start);
  if (!starts.length) return [];
  const first = Math.min(...starts);
  return first > 0.1 ? [{ id: 'late-start', rule: 'late-start', severity: 'aviso', message: `Os primeiros ${first.toFixed(1)} s ficam sem imagem (só a cor de fundo)`, time: 0 }] : [];
}

function shortClips(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const t of p.tracks) for (const c of t.clips) if (c.type !== 'caption' && c.duration < SHORT_CLIP) out.push({ id: `short-clip:${c.id}`, rule: 'short-clip', severity: 'dica', message: `Clipe de ${(c.duration * 1000).toFixed(0)} ms em "${t.name}" — pode ser um corte esquecido`, time: c.start, clipIds: [c.id], trackId: t.id });
  return out;
}

function captionIssues(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const id of fastCaptionIds(p)) {
    const c = p.tracks.flatMap((t) => t.clips).find((x) => x.id === id)!;
    out.push({ id: `caption-fast:${id}`, rule: 'caption-fast', severity: 'aviso', message: `Legenda em ${fmt(c.start)} é rápida demais para ler (mais de 20 caracteres por segundo)`, time: c.start, clipIds: [id] });
  }
  const caps = p.tracks.filter((t) => t.kind === 'caption' && !t.hidden).flatMap((t) => t.clips.map((c) => ({ c, t })));
  for (let i = 0; i < caps.length; i++) {
    for (let j = i + 1; j < caps.length; j++) {
      const a = caps[i]!;
      const b = caps[j]!;
      if (a.t.id === b.t.id) continue; // dentro da mesma faixa o editor já impede
      if (a.c.start < clipEnd(b.c) - 1e-6 && b.c.start < clipEnd(a.c) - 1e-6) out.push({ id: `caption-overlap:${a.c.id}:${b.c.id}`, rule: 'caption-overlap', severity: 'erro', message: `Duas legendas aparecem ao mesmo tempo em ${fmt(Math.max(a.c.start, b.c.start))}`, time: Math.max(a.c.start, b.c.start), clipIds: [a.c.id, b.c.id] });
    }
  }
  return out;
}

function audible(p: Project): boolean {
  return p.tracks.some((t) => !t.muted && t.clips.some((c) => c.type === 'media' && !c.audio.muted && p.media[c.mediaId]?.hasAudio));
}

function noCaptions(p: Project): ReviewIssue[] {
  const dur = projectDuration(p);
  const hasCaptions = p.tracks.some((t) => t.kind === 'caption' && t.clips.length > 0);
  return dur >= 15 && audible(p) && !hasCaptions ? [{ id: 'no-captions', rule: 'no-captions', severity: 'aviso', message: 'O vídeo tem som e mais de 15 s, mas nenhuma legenda — quem assiste sem áudio perde o conteúdo' }] : [];
}

function upscale(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  const frame = { width: p.settings.width, height: p.settings.height };
  for (const t of p.tracks) {
    for (const c of t.clips) {
      if (!isVisualMedia(p, c, t) || c.type !== 'media') continue;
      const a = p.media[c.mediaId];
      if (!a || a.width <= 0 || a.height <= 0) continue;
      const shown = shownFraction(a, frame, c.transform.scale);
      const factor = (shown.w * frame.width) / a.width;
      if (factor >= UPSCALE_WARN) out.push({ id: `upscale:${c.id}`, rule: 'upscale', severity: factor >= UPSCALE_ERROR ? 'erro' : 'aviso', message: `"${a.name}" está ampliada ${Math.round(factor * 100)}% — vai ficar borrada`, time: c.start, clipIds: [c.id], trackId: t.id });
    }
  }
  return out;
}

function loud(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const t of p.tracks) {
    for (const c of t.clips) {
      if (c.type !== 'media' || c.audio.muted || c.audio.volume < LOUD_WARN) continue;
      out.push({ id: `loud:${c.id}`, rule: 'loud', severity: c.audio.volume >= LOUD_ERROR ? 'erro' : 'aviso', message: `Volume em ${Math.round(c.audio.volume * 100)}% em ${fmt(c.start)} — risco de distorção`, time: c.start, clipIds: [c.id], trackId: t.id });
    }
  }
  return out;
}

function textIssues(p: Project, platformId?: string): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  const platform = platformId ? getPlatform(platformId) : undefined;
  const bg = p.settings.background;
  const visual = p.tracks.flatMap((t) => t.clips.filter((c) => isVisualMedia(p, c, t)));
  for (const t of p.tracks) {
    if (t.hidden) continue;
    for (const c of t.clips) {
      if (c.type === 'media') continue;
      if (platform && !isInsideSafe(platform, c.transform.x, c.transform.y)) out.push({ id: `text-unsafe:${c.id}`, rule: 'text-unsafe', severity: 'aviso', message: `Texto em ${fmt(c.start)} cai na área coberta pela interface de ${platform.label}`, time: c.start, clipIds: [c.id], trackId: t.id });
      // Só dá para afirmar o contraste quando não há mídia visual por baixo: o fundo é a cor sólida do projeto.
      const over = visual.some((v) => v.start < clipEnd(c) - 1e-6 && clipEnd(v) > c.start + 1e-6);
      const style = c.type === 'text' || c.type === 'caption' ? c.style : undefined;
      if (!style || over) continue;
      const against = style.background && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(style.background) && style.background.length === 9 && style.background.slice(7) !== '00' ? style.background : bg;
      const ratio = contrastRatio(style.color, against);
      if (ratio !== null && ratio < CONTRAST_MIN) out.push({ id: `text-contrast:${c.id}`, rule: 'text-contrast', severity: 'aviso', message: `Texto em ${fmt(c.start)} tem contraste ${ratio.toFixed(1)}:1 com o fundo (o mínimo recomendado é ${CONTRAST_MIN}:1)`, time: c.start, clipIds: [c.id], trackId: t.id });
    }
  }
  return out;
}

function trackIssues(p: Project): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  for (const t of p.tracks) {
    if (t.clips.length === 0) out.push({ id: `empty-track:${t.id}`, rule: 'empty-track', severity: 'dica', message: `A faixa "${t.name}" está vazia`, trackId: t.id, fix: { kind: 'remove-track', label: 'Remover faixa' } });
    else if (t.hidden) out.push({ id: `hidden-has-clips:${t.id}`, rule: 'hidden-has-clips', severity: 'aviso', message: `A faixa "${t.name}" está oculta e tem ${t.clips.length} ${t.clips.length === 1 ? 'clipe' : 'clipes'}: eles não aparecem na exportação`, trackId: t.id, fix: { kind: 'show-track', label: 'Mostrar faixa' } });
  }
  return out;
}

function platformIssues(p: Project, platformId?: string): ReviewIssue[] {
  const platform = platformId ? getPlatform(platformId) : undefined;
  if (!platform) return [];
  const out: ReviewIssue[] = [];
  const dur = projectDuration(p);
  if (platform.recommendedMaxSeconds > 0 && dur > platform.recommendedMaxSeconds) out.push({ id: 'too-long', rule: 'too-long', severity: 'aviso', message: `${fmt(dur)} passa dos ${platform.recommendedMaxSeconds} s recomendados para ${platform.label}` });
  if (!matchesAspect(platform, p.settings.width, p.settings.height)) out.push({ id: 'aspect', rule: 'aspect', severity: 'aviso', message: `O projeto é ${p.settings.width}×${p.settings.height}, mas ${platform.label} usa ${platform.width}×${platform.height}`, fix: { kind: 'set-platform-format', label: `Usar ${platform.width}×${platform.height}` } });
  return out;
}

function unusedIssues(p: Project, libraryIds?: string[]): ReviewIssue[] {
  if (!libraryIds) return [];
  const ids = unusedMediaIds(p, libraryIds);
  if (!ids.length) return [];
  return [{ id: 'unused-media', rule: 'unused-media', severity: 'dica', message: ids.length === 1 ? '1 mídia importada não é usada em nenhum clipe' : ids.length + ' mídias importadas não são usadas em nenhum clipe' }];
}

const ORDER: Record<Severity, number> = { erro: 0, aviso: 1, dica: 2 };

/** Roda todas as verificações e devolve os problemas, dos mais graves aos menos graves (e por tempo). */
export function reviewProject(p: Project, opts: ReviewOptions = {}): ReviewIssue[] {
  const issues: ReviewIssue[] = [
    ...gapIssues(p),
    ...lateStart(p),
    ...shortClips(p),
    ...captionIssues(p),
    ...noCaptions(p),
    ...upscale(p),
    ...loud(p),
    ...textIssues(p, opts.platformId),
    ...trackIssues(p),
    ...platformIssues(p, opts.platformId),
    ...unusedIssues(p, opts.libraryIds),
  ];
  return issues.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.time ?? 0) - (b.time ?? 0));
}

/** Nota de 0 a 100: cada erro tira 12 pontos, cada aviso 5 e cada dica 1. */
export function reviewScore(issues: ReviewIssue[]): number {
  const loss = issues.reduce((n, i) => n + (i.severity === 'erro' ? 12 : i.severity === 'aviso' ? 5 : 1), 0);
  return Math.max(0, 100 - loss);
}

/** Regras que afetam quem assiste sem som, com baixa visão ou lendo rápido. */
export const ACCESSIBILITY_RULES: RuleId[] = ['no-captions', 'caption-fast', 'caption-overlap', 'text-contrast', 'text-unsafe'];

/** Nota de acessibilidade (0–100): cada problema de acessibilidade tira 15 pontos (erro) ou 8 (aviso). */
export function accessibilityScore(issues: ReviewIssue[]): number {
  const loss = issues.filter((i) => ACCESSIBILITY_RULES.includes(i.rule)).reduce((n, i) => n + (i.severity === 'erro' ? 15 : 8), 0);
  return Math.max(0, 100 - loss);
}
