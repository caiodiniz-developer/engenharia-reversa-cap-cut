import { useMemo } from 'react';
import { accessibilityScore, reviewProject, reviewScore, type ReviewIssue } from '@editor/core';
import { useEditor } from '../store/editor';

export interface ReviewState {
  issues: ReviewIssue[];
  score: number;
  access: number;
  /** Erros + avisos (as dicas não entram na contagem do selo). */
  attention: number;
}

/** Resultado da revisão do projeto atual, recalculado só quando o projeto, a biblioteca ou a plataforma mudam. */
export function useReview(): ReviewState {
  const project = useEditor((s) => s.project);
  const media = useEditor((s) => s.media);
  const platformId = useEditor((s) => s.platformId);
  return useMemo(() => {
    const issues = reviewProject(project, { platformId: platformId ?? undefined, libraryIds: Object.keys(media) });
    return { issues, score: reviewScore(issues), access: accessibilityScore(issues), attention: issues.filter((i) => i.severity !== 'dica').length };
  }, [project, media, platformId]);
}
