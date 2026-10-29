import { addClip, addMedia, addTrack, createProject, MediaClipSchema, pacingCurve, pacingLabel, pacingStats, stillStretches, type MediaAsset, type Project } from '@editor/core';

const ASSET: MediaAsset = { id: 'demo', name: 'cena.mp4', kind: 'video', duration: 600, width: 1920, height: 1080, fps: 30, hasAudio: false, size: 1, mime: 'video/mp4' };
export const DEMO_TOTAL = 30;

/**
 * Durações de planos que somam exatamente `total` segundos e têm média próxima de `avg`:
 * alternam ±30% em torno da média e o último plano absorve o que sobrar.
 */
export function shotLengths(avg: number, total = DEMO_TOTAL): number[] {
  const a = Math.min(Math.max(avg, 0.5), total);
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; sum < total - 0.05; i++) {
    const len = Math.round(a * (i % 2 === 0 ? 0.7 : 1.3) * 10) / 10;
    const take = Math.min(Math.max(len, 0.3), Math.round((total - sum) * 10) / 10);
    out.push(take);
    sum = Math.round((sum + take) * 10) / 10;
  }
  // se o último ficou pequeno demais, junta ao anterior
  if (out.length > 1 && out[out.length - 1]! < 0.3) out[out.length - 2] = Math.round((out[out.length - 2]! + out.pop()!) * 10) / 10;
  return out;
}

export function buildPacingProject(avg: number): Project {
  let p = addMedia(createProject('Ritmo', { fps: 30 }), ASSET);
  const v = addTrack(p, 'video');
  p = v.project;
  let t = 0;
  shotLengths(avg).forEach((len, i) => {
    p = addClip(p, v.track.id, MediaClipSchema.parse({ id: 'p' + i, type: 'media', mediaId: 'demo', start: Math.round(t * 10) / 10, duration: len }));
    t += len;
  });
  return p;
}

export function pacingDemoState(avg: number) {
  const p = buildPacingProject(avg);
  const stats = pacingStats(p)!;
  return { stats, label: pacingLabel(stats.average), curve: pacingCurve(p, 5), still: stillStretches(p, 5, 3) };
}
