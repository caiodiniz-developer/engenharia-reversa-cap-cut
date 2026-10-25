import { describe, expect, it } from 'vitest';
import { createProject, parseProject, projectDuration } from '@editor/core';
import { ASPECTS } from './format';
import { getTemplate, TEMPLATES } from './templates';

describe('modelos de projeto', () => {
  it('todos geram um documento válido no formato anunciado', () => {
    for (const t of TEMPLATES) {
      const a = ASPECTS.find((x) => x.id === t.aspect)!;
      const doc = t.build(createProject(t.name, { width: a.width, height: a.height }));
      expect(() => parseProject(JSON.parse(JSON.stringify(doc))), t.id).not.toThrow();
      expect(doc.settings).toMatchObject({ width: a.width, height: a.height });
    }
  });

  it('o vertical tem título, faixa de vídeo e faixa de legendas', () => {
    const doc = getTemplate('vertical').build(createProject('x', { width: 1080, height: 1920 }));
    expect(doc.tracks.map((t) => t.kind).sort()).toEqual(['caption', 'text', 'video']);
    expect(doc.tracks.find((t) => t.kind === 'text')!.clips[0]).toMatchObject({ type: 'text', text: 'Seu título aqui' });
    expect(projectDuration(doc)).toBe(4);
  });

  it('em branco não cria faixas; id desconhecido cai no em branco', () => {
    expect(getTemplate('blank').build(createProject()).tracks).toHaveLength(0);
    expect(getTemplate('nao-existe').id).toBe('blank');
  });

  it('ids únicos e o YouTube/Apresentação incluem faixa de áudio', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const id of ['youtube', 'slides']) expect(getTemplate(id).build(createProject()).tracks.some((t) => t.kind === 'audio')).toBe(true);
  });
});
