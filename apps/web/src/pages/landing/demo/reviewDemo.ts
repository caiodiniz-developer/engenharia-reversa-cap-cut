import {
  addClip,
  addMedia,
  addTrack,
  closeGaps,
  createProject,
  MediaClipSchema,
  CaptionClipSchema,
  reviewProject,
  reviewScore,
  setClipsDuration,
  setTrackProps,
  type MediaAsset,
  type Project,
  type ReviewIssue,
} from '@editor/core';

const ASSET: MediaAsset = { id: 'demo', name: 'entrevista.mp4', kind: 'video', duration: 60, width: 1920, height: 1080, fps: 30, hasAudio: true, size: 1_000_000, mime: 'video/mp4' };

const clip = (start: number, duration: number, id: string) => MediaClipSchema.parse({ id, type: 'media', mediaId: 'demo', start, duration });

/** Projeto de exemplo da landing: montado com as mesmas operações do editor, com três problemas reais para a Revisão achar. */
export function buildReviewDemo(): Project {
  let p = addMedia(createProject('Demonstração', { width: 1920, height: 1080, fps: 30 }), ASSET);
  const v1 = addTrack(p, 'video');
  p = v1.project;
  p = addClip(p, v1.track.id, clip(0, 4, 'd1'));
  p = addClip(p, v1.track.id, clip(7, 4, 'd2')); // espaço de 3 s entre d1 e d2
  p = addClip(p, v1.track.id, clip(11, 3, 'd3'));
  const cap = addTrack(p, 'caption');
  p = addClip(cap.project, cap.track.id, CaptionClipSchema.parse({ id: 'dcap', type: 'caption', start: 1, duration: 1, text: 'Esta legenda é longa demais para ser lida em um segundo' }));
  const v2 = addTrack(p, 'video', { name: 'Vídeo extra' });
  p = addClip(v2.project, v2.track.id, clip(0, 2, 'd4'));
  return setTrackProps(p, v2.track.id, { hidden: true });
}

export interface DemoAction {
  label: string;
  apply(p: Project): Project;
}

/** Correção disponível para cada problema da demonstração (todas usam operações reais do editor). */
export function demoAction(issue: ReviewIssue): DemoAction | null {
  if (issue.fix?.kind === 'close-gaps' && issue.trackId) return { label: issue.fix.label, apply: (p) => closeGaps(p, issue.trackId!) };
  if (issue.fix?.kind === 'show-track' && issue.trackId) return { label: issue.fix.label, apply: (p) => setTrackProps(p, issue.trackId!, { hidden: false }) };
  if (issue.rule === 'caption-fast' && issue.clipIds?.[0]) return { label: 'Dar 3 s à legenda', apply: (p) => setClipsDuration(p, [issue.clipIds![0]!], 3) };
  return null;
}

export function reviewDemoState(p: Project): { issues: ReviewIssue[]; score: number } {
  const issues = reviewProject(p);
  return { issues, score: reviewScore(issues) };
}
