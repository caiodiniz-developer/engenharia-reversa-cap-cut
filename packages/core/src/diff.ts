import { projectDuration } from './project';
import type { Clip, Project } from './schema';

export interface ProjectDiff {
  added: string[];
  removed: string[];
  /** Mudou o início (o clipe andou na timeline). */
  moved: string[];
  /** Mudou a duração. */
  resized: string[];
  /** Mudou o conteúdo de texto ou legenda. */
  retyped: string[];
  /** Mudou qualquer outra propriedade (efeitos, volume, velocidade, transformação…). */
  adjusted: string[];
  tracksAdded: string[];
  tracksRemoved: string[];
  markersAdded: number;
  markersRemoved: number;
  /** Duração do projeto: depois − antes, em segundos. */
  durationDelta: number;
  /** Nada mudou. */
  identical: boolean;
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, val: unknown) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));

function clipsById(p: Project): Map<string, Clip> {
  return new Map(p.tracks.flatMap((t) => t.clips).map((c) => [c.id, c]));
}

/** Compara dois estados do projeto pelo id dos clipes e das faixas e resume o que mudou de `before` para `after`. */
export function diffProjects(before: Project, after: Project): ProjectDiff {
  const a = clipsById(before);
  const b = clipsById(after);
  const d: ProjectDiff = { added: [], removed: [], moved: [], resized: [], retyped: [], adjusted: [], tracksAdded: [], tracksRemoved: [], markersAdded: 0, markersRemoved: 0, durationDelta: 0, identical: false };
  for (const [id, c] of b) if (!a.has(id)) d.added.push(id);
  for (const [id, old] of a) {
    const now = b.get(id);
    if (!now) {
      d.removed.push(id);
      continue;
    }
    if (Math.abs(old.start - now.start) > 1e-6) d.moved.push(id);
    if (Math.abs(old.duration - now.duration) > 1e-6) d.resized.push(id);
    if ((old.type === 'text' || old.type === 'caption') && (now.type === 'text' || now.type === 'caption') && old.text !== now.text) d.retyped.push(id);
    const strip = (c: Clip) => ({ ...c, start: 0, duration: 0, text: undefined, words: undefined });
    if (stable(strip(old)) !== stable(strip(now))) d.adjusted.push(id);
  }
  const ta = new Set(before.tracks.map((t) => t.id));
  const tb = new Set(after.tracks.map((t) => t.id));
  d.tracksAdded = [...tb].filter((id) => !ta.has(id));
  d.tracksRemoved = [...ta].filter((id) => !tb.has(id));
  const ma = new Set(before.markers.map((m) => m.id));
  const mb = new Set(after.markers.map((m) => m.id));
  d.markersAdded = [...mb].filter((id) => !ma.has(id)).length;
  d.markersRemoved = [...ma].filter((id) => !mb.has(id)).length;
  d.durationDelta = Math.round((projectDuration(after) - projectDuration(before)) * 1000) / 1000;
  d.identical = !(d.added.length || d.removed.length || d.moved.length || d.resized.length || d.retyped.length || d.adjusted.length || d.tracksAdded.length || d.tracksRemoved.length || d.markersAdded || d.markersRemoved || d.durationDelta);
  return d;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Frases curtas em português descrevendo as diferenças (vazio se nada mudou). */
export function describeDiff(d: ProjectDiff): string[] {
  const out: string[] = [];
  if (d.added.length) out.push(`${plural(d.added.length, 'clipe adicionado', 'clipes adicionados')}`);
  if (d.removed.length) out.push(`${plural(d.removed.length, 'clipe removido', 'clipes removidos')}`);
  if (d.moved.length) out.push(`${plural(d.moved.length, 'clipe movido', 'clipes movidos')}`);
  if (d.resized.length) out.push(`${plural(d.resized.length, 'clipe com duração alterada', 'clipes com duração alterada')}`);
  if (d.retyped.length) out.push(`${plural(d.retyped.length, 'texto reescrito', 'textos reescritos')}`);
  if (d.adjusted.length) out.push(`${plural(d.adjusted.length, 'clipe com ajustes (efeitos, volume, velocidade…)', 'clipes com ajustes (efeitos, volume, velocidade…)')}`);
  if (d.tracksAdded.length) out.push(`${plural(d.tracksAdded.length, 'faixa adicionada', 'faixas adicionadas')}`);
  if (d.tracksRemoved.length) out.push(`${plural(d.tracksRemoved.length, 'faixa removida', 'faixas removidas')}`);
  if (d.markersAdded) out.push(`${plural(d.markersAdded, 'marcador novo', 'marcadores novos')}`);
  if (d.markersRemoved) out.push(`${plural(d.markersRemoved, 'marcador removido', 'marcadores removidos')}`);
  if (d.durationDelta) out.push(`Duração ${d.durationDelta > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(d.durationDelta).toFixed(1).replace('.', ',')} s`);
  return out;
}
