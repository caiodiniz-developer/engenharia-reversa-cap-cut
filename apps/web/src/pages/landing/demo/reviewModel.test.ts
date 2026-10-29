import { describe, expect, it } from 'vitest';
import { buildReviewDemo, demoAction, reviewDemoState } from './reviewModel';

describe('demonstração da Revisão', () => {
  it('o projeto de exemplo tem exatamente os três problemas planejados', () => {
    const { issues, score } = reviewDemoState(buildReviewDemo());
    expect(issues.map((i) => i.rule).sort()).toEqual(['caption-fast', 'gap', 'hidden-has-clips']);
    expect(score).toBe(85);
  });

  it('todo problema tem uma correção e aplicá-la elimina o problema e sobe a nota', () => {
    let p = buildReviewDemo();
    let last = reviewDemoState(p).score;
    for (const rule of ['gap', 'hidden-has-clips', 'caption-fast'] as const) {
      const issue = reviewDemoState(p).issues.find((i) => i.rule === rule)!;
      const action = demoAction(issue);
      expect(action, rule).not.toBeNull();
      p = action!.apply(p);
      const now = reviewDemoState(p);
      expect(now.issues.some((i) => i.rule === rule), rule).toBe(false);
      expect(now.score, rule).toBeGreaterThan(last);
      last = now.score;
    }
    expect(last).toBe(100);
    expect(reviewDemoState(p).issues).toEqual([]);
  });

  it('fechar o espaço realmente encosta os clipes (3 s a menos de duração)', () => {
    const p = buildReviewDemo();
    const gap = reviewDemoState(p).issues.find((i) => i.rule === 'gap')!;
    const after = demoAction(gap)!.apply(p);
    const ends = (q: typeof p) => Math.max(...q.tracks.filter((t) => t.kind === 'video' && !t.hidden).flatMap((t) => t.clips.map((c) => c.start + c.duration)));
    expect(ends(p)).toBe(14);
    expect(ends(after)).toBe(11);
  });

  it('problemas sem correção devolvem null', () => {
    expect(demoAction({ id: 'x', rule: 'upscale', severity: 'aviso', message: '' })).toBeNull();
  });
});
