import { addClip, addTrack, newId, TextClipSchema, type Project } from '@editor/core';
import type { IconName } from '../components/Icon';
import { ASPECTS } from './format';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  aspect: (typeof ASPECTS)[number]['id'];
  icon: IconName;
  /** Acrescenta as faixas/clipes iniciais ao documento recém-criado. */
  build(doc: Project): Project;
}

function withTitle(doc: Project, text: string, opts: { y: number; fontSize: number; duration?: number }): Project {
  const r = addTrack(doc, 'text');
  const clip = TextClipSchema.parse({
    id: newId('clp'),
    type: 'text',
    text,
    start: 0,
    duration: opts.duration ?? 4,
    style: { fontSize: opts.fontSize, bold: true, strokeWidth: 4, shadowBlur: 8, shadowY: 3 },
    transform: { y: opts.y },
    animationIn: { type: 'fade', duration: 0.5 },
  });
  return addClip(r.project, r.track.id, clip);
}

export const TEMPLATES: ProjectTemplate[] = [
  { id: 'blank', name: 'Em branco', description: 'Comece do zero em 16:9', aspect: '16:9', icon: 'film', build: (d) => d },
  {
    id: 'vertical',
    name: 'Vertical curto',
    description: '9:16 para Reels, TikTok e Shorts, com título e faixa de legendas',
    aspect: '9:16',
    icon: 'sparkles',
    build: (d) => addTrack(addTrack(withTitle(d, 'Seu título aqui', { y: -0.3, fontSize: 96 }), 'video').project, 'caption').project,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: '16:9 com título de abertura e faixa de música',
    aspect: '16:9',
    icon: 'play',
    build: (d) => addTrack(addTrack(withTitle(d, 'Título do vídeo', { y: 0, fontSize: 120 }), 'video').project, 'audio').project,
  },
  {
    id: 'square',
    name: 'Quadrado para feed',
    description: '1:1 para posts de Instagram e LinkedIn',
    aspect: '1:1',
    icon: 'layout',
    build: (d) => addTrack(withTitle(d, 'Legenda do post', { y: 0.32, fontSize: 78 }), 'video').project,
  },
  {
    id: 'portrait',
    name: 'Retrato 4:5',
    description: 'Mais altura no feed, com título na base',
    aspect: '4:5',
    icon: 'image',
    build: (d) => addTrack(withTitle(d, 'Título', { y: 0.3, fontSize: 84 }), 'video').project,
  },
  {
    id: 'slides',
    name: 'Apresentação',
    description: '16:9 para fotos e slides com trilha sonora',
    aspect: '16:9',
    icon: 'layers',
    build: (d) => addTrack(addTrack(withTitle(d, 'Apresentação', { y: -0.05, fontSize: 130, duration: 5 }), 'video').project, 'audio').project,
  },
];

export const getTemplate = (id: string): ProjectTemplate => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
