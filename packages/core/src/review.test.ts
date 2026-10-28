import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import { addMedia, createProject } from './project';
import { CaptionClipSchema, TextClipSchema, type MediaAsset, type Project } from './schema';
import { accessibilityScore, reviewProject, reviewScore, type RuleId } from './review';
import { addClip } from './ops/clips';
import { addTrack, setTrackProps } from './ops/tracks';
import { updateClip } from './ops/clips';
import { mediaClip, videoAsset } from './testing';

const small = (id: string): MediaAsset => ({ ...videoAsset(id, 10), width: 640, height: 360, name: `${id}.mp4` });

/** Projeto 1080p com um vídeo grande (m1, com áudio) e um pequeno (s1, 640×360). */
function base() {
  let p: Project = createProject('rev', { width: 1920, height: 1080, fps: 30 });
  p = addMedia(addMedia(p, videoAsset('m1', 30)), small('s1'));
  const v = addTrack(p, 'video');
  return { p: v.project, vid: v.track.id };
}

const rules = (p: Project, opts = {}): RuleId[] => reviewProject(p, opts).map((i) => i.rule);
const text = (start: number, duration: number, extra = {}) => TextClipSchema.parse({ id: newId('clp'), type: 'text', start, duration, text: 'Oi', ...extra });

describe('reviewProject', () => {
  it('projeto saudável não gera problemas e tem nota 100', () => {
    const { p, vid } = base();
    const q = addClip(p, vid, mediaClip('m1', 0, 5));
    expect(reviewProject(q)).toEqual([]);
    expect(reviewScore(reviewProject(q))).toBe(100);
  });

  it('espaço vazio entre clipes da mesma faixa de vídeo, com correção', () => {
    const { p, vid } = base();
    const q = addClip(addClip(p, vid, mediaClip('m1', 0, 2)), vid, mediaClip('m1', 4, 2));
    const gap = reviewProject(q).find((i) => i.rule === 'gap')!;
    expect(gap).toMatchObject({ severity: 'aviso', time: 2, trackId: vid, fix: { kind: 'close-gaps' } });
    expect(gap.message).toContain('2.0 s');
    // 0,3 s de vão não conta
    const tiny = addClip(addClip(p, vid, mediaClip('m1', 0, 2)), vid, mediaClip('m1', 2.3, 2));
    expect(rules(tiny)).not.toContain('gap');
  });

  it('início sem imagem quando o primeiro clipe visual começa depois de 0,1 s', () => {
    const { p, vid } = base();
    expect(rules(addClip(p, vid, mediaClip('m1', 2, 3)))).toContain('late-start');
    expect(rules(addClip(p, vid, mediaClip('m1', 0.05, 3)))).not.toContain('late-start');
  });

  it('clipes menores que 0,3 s viram dica (legendas não entram)', () => {
    const { p, vid } = base();
    const q = addClip(addClip(p, vid, mediaClip('m1', 0, 0.2)), vid, mediaClip('m1', 0.2, 3));
    const issues = reviewProject(q).filter((i) => i.rule === 'short-clip');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('dica');
  });

  it('mídia ampliada além da resolução: aviso a partir de 125% e erro a partir de 200%', () => {
    const { p, vid } = base();
    // s1 é 640×360 num quadro 1920×1080: na escala 1 ocupa o quadro = 300%
    const big = addClip(p, vid, mediaClip('s1', 0, 3));
    expect(reviewProject(big).find((i) => i.rule === 'upscale')).toMatchObject({ severity: 'erro' });
    const c = mediaClip('s1', 0, 3);
    const half = updateClip(addClip(p, vid, c), c.id, (x) => ({ ...x, transform: { ...(x as typeof c).transform, scale: 0.5 } }));
    expect(reviewProject(half).find((i) => i.rule === 'upscale')).toMatchObject({ severity: 'aviso' }); // 150%
    // um vídeo 1080p no quadro 1080p não é ampliado
    expect(rules(addClip(p, vid, mediaClip('m1', 0, 3)))).not.toContain('upscale');
  });

  it('volume muito alto: aviso a partir de 150% e erro a partir de 300%; mudo não conta', () => {
    const { p, vid } = base();
    const mk = (volume: number, muted = false) => {
      const c = mediaClip('m1', 0, 3, { audio: { volume, muted } as never });
      return addClip(p, vid, c);
    };
    expect(rules(mk(1.4))).not.toContain('loud');
    expect(reviewProject(mk(2)).find((i) => i.rule === 'loud')!.severity).toBe('aviso');
    expect(reviewProject(mk(3.5)).find((i) => i.rule === 'loud')!.severity).toBe('erro');
    expect(rules(mk(3.5, true))).not.toContain('loud');
  });

  it('legendas rápidas demais e legendas sobrepostas em faixas diferentes', () => {
    const { p } = base();
    const t1 = addTrack(p, 'caption');
    const t2 = addTrack(t1.project, 'caption');
    const fast = CaptionClipSchema.parse({ id: 'cap-a', type: 'caption', start: 0, duration: 1, text: 'Uma legenda longa demais para ser lida em um segundo' });
    const other = CaptionClipSchema.parse({ id: 'cap-b', type: 'caption', start: 0.5, duration: 2, text: 'Ok' });
    const q = addClip(addClip(t2.project, t1.track.id, fast), t2.track.id, other);
    const issues = reviewProject(q);
    expect(issues.find((i) => i.rule === 'caption-fast')).toMatchObject({ severity: 'aviso', clipIds: ['cap-a'] });
    const overlap = issues.find((i) => i.rule === 'caption-overlap')!;
    expect(overlap.severity).toBe('erro');
    expect([...overlap.clipIds!].sort()).toEqual(['cap-a', 'cap-b']);
  });

  it('sem legendas: só quando há som, passa de 15 s e não existe nenhuma legenda', () => {
    const { p, vid } = base();
    expect(rules(addClip(p, vid, mediaClip('m1', 0, 20)))).toContain('no-captions');
    expect(rules(addClip(p, vid, mediaClip('m1', 0, 10)))).not.toContain('no-captions');
    const muted = addClip(p, vid, mediaClip('m1', 0, 20, { audio: { muted: true } as never }));
    expect(rules(muted)).not.toContain('no-captions');
    const tc = addTrack(addClip(p, vid, mediaClip('m1', 0, 20)), 'caption');
    const withCap = addClip(tc.project, tc.track.id, CaptionClipSchema.parse({ id: 'c1', type: 'caption', start: 0, duration: 3, text: 'Olá' }));
    expect(rules(withCap)).not.toContain('no-captions');
  });

  it('contraste: branco sobre fundo claro avisa; sobre vídeo (fundo desconhecido) não afirma nada', () => {
    const { p, vid } = base();
    const light = { ...p, settings: { ...p.settings, background: '#ffffff' } };
    const tt = addTrack(light, 'text');
    const q = addClip(tt.project, tt.track.id, text(0, 2, { style: { color: '#ffffff' } }));
    expect(reviewProject(q).find((i) => i.rule === 'text-contrast')).toBeTruthy();
    // branco sobre o fundo escuro padrão é legível
    const dk = addTrack(p, 'text');
    expect(rules(addClip(dk.project, dk.track.id, text(0, 2, { style: { color: '#ffffff' } })))).not.toContain('text-contrast');
    // com um vídeo por baixo do texto não há como saber a cor do fundo
    const t2 = addTrack(addClip(light, vid, mediaClip('m1', 0, 5)), 'text');
    const over = addClip(t2.project, t2.track.id, text(0, 2, { style: { color: '#ffffff' } }));
    expect(rules(over)).not.toContain('text-contrast');
  });

  it('plataforma: duração recomendada, formato e zona segura', () => {
    const { p, vid } = base();
    const long = addClip(p, vid, mediaClip('m1', 0, 30));
    const tt = addTrack(long, 'text');
    const low = addClip(tt.project, tt.track.id, text(0, 2, { transform: { y: 0.45 } }));
    const issues = reviewProject(low, { platformId: 'shorts' });
    expect(issues.map((i) => i.rule)).toEqual(expect.arrayContaining(['aspect', 'text-unsafe']));
    expect(issues.find((i) => i.rule === 'aspect')!.fix).toMatchObject({ kind: 'set-platform-format' });
    expect(issues.map((i) => i.rule)).not.toContain('too-long'); // 30 s < 60 s
    const veryLong = addClip(p, vid, mediaClip('m1', 0, 30));
    const again = addClip(addClip(veryLong, vid, mediaClip('m1', 30, 30)), vid, mediaClip('m1', 60, 5)); // 65 s
    expect(rules(again, { platformId: 'tiktok' })).toContain('too-long');
    expect(rules(again, { platformId: 'youtube' })).not.toContain('too-long'); // sem limite recomendado
    expect(rules(again, { platformId: 'youtube' })).not.toContain('aspect'); // 16:9
  });

  it('faixa vazia (dica) e faixa oculta com clipes (aviso)', () => {
    const { p, vid } = base();
    const q = addClip(p, vid, mediaClip('m1', 0, 3));
    const empty = addTrack(q, 'audio');
    const issue = reviewProject(empty.project).find((i) => i.rule === 'empty-track')!;
    expect(issue).toMatchObject({ severity: 'dica', trackId: empty.track.id, fix: { kind: 'remove-track' } });
    const hidden = setTrackProps(q, vid, { hidden: true });
    expect(reviewProject(hidden).find((i) => i.rule === 'hidden-has-clips')).toMatchObject({ severity: 'aviso', fix: { kind: 'show-track' } });
  });

  it('mídias não usadas só entram quando a biblioteca é informada', () => {
    const { p, vid } = base();
    const q = addClip(p, vid, mediaClip('m1', 0, 3));
    expect(rules(q)).not.toContain('unused-media');
    const issue = reviewProject(q, { libraryIds: ['m1', 's1', 'x9'] }).find((i) => i.rule === 'unused-media')!;
    expect(issue.message).toContain('2 mídias');
  });

  it('ordena do mais grave ao menos grave', () => {
    const { p, vid } = base();
    const q = addClip(addClip(p, vid, mediaClip('s1', 0, 0.2)), vid, mediaClip('m1', 3, 3, { audio: { volume: 4 } as never }));
    const sev = reviewProject(q).map((i) => i.severity);
    const rank = { erro: 0, aviso: 1, dica: 2 } as const;
    expect(sev.map((s) => rank[s])).toEqual([...sev.map((s) => rank[s])].sort((a, b) => a - b));
  });
});

describe('notas', () => {
  it('reviewScore desconta 12 por erro, 5 por aviso e 1 por dica, sem passar de 0', () => {
    const mk = (severity: 'erro' | 'aviso' | 'dica') => ({ id: severity, rule: 'gap' as const, severity, message: '' });
    expect(reviewScore([mk('erro'), mk('aviso'), mk('dica')])).toBe(100 - 12 - 5 - 1);
    expect(reviewScore(Array.from({ length: 20 }, () => mk('erro')))).toBe(0);
  });

  it('accessibilityScore só olha regras de acessibilidade', () => {
    const issue = (rule: RuleId, severity: 'erro' | 'aviso') => ({ id: rule, rule, severity, message: '' });
    expect(accessibilityScore([issue('gap', 'aviso'), issue('loud', 'erro')])).toBe(100);
    expect(accessibilityScore([issue('no-captions', 'aviso'), issue('caption-overlap', 'erro')])).toBe(100 - 8 - 15);
  });
});
