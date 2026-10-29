import { ANIMATION_PRESETS, BUILTIN_LUTS, EFFECTS, PLATFORMS, RULE_TITLE, TRANSITION_TYPES } from '@editor/core';
import type { IconName } from '../../components/Icon';

/** Textos e dados da landing page. Os números vêm do próprio código do editor, então nunca ficam desatualizados. */

export const NAV: Array<{ id: string; label: string }> = [
  { id: 'recursos', label: 'Recursos' },
  { id: 'diferenciais', label: 'Diferenciais' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'perguntas', label: 'Perguntas' },
];

export const HERO = {
  eyebrow: 'Editor de vídeo no navegador',
  title: 'Edite, revise e exporte seus vídeos sem instalar nada.',
  subtitle: 'Timeline multifaixa, legendas, efeitos e exportação em MP4, WebM, GIF ou só áudio — tudo no navegador, com o mesmo resultado na prévia e no arquivo final.',
  primary: 'Criar conta',
  secondary: 'Já tenho conta',
  note: 'Seus projetos ficam salvos na sua conta e abrem de qualquer computador.',
};

export interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

export const FEATURES: Feature[] = [
  { icon: 'layers', title: 'Timeline multifaixa', text: 'Vídeo, áudio, texto e legendas em faixas separadas, com ímã, marcadores, agrupamento e desfazer/refazer.' },
  { icon: 'captions', title: 'Legendas e textos', text: 'Importe SRT/VTT, estilize com contorno, sombra e degradê e destaque a palavra falada.' },
  { icon: 'wand', title: 'Efeitos e cores', text: 'Efeitos de cor, desfoque e recorte, LUTs 3D (.cube), máscaras e chroma key — iguais na prévia e na exportação.' },
  { icon: 'music', title: 'Áudio de verdade', text: 'Gravação de voz, equalizador, fades, redução de ruído e normalização de volume medida no arquivo.' },
  { icon: 'zap', title: 'Animações e transições', text: 'Entradas, saídas e movimentos prontos que viram keyframes editáveis, mais transições entre clipes.' },
  { icon: 'download', title: 'Exportação completa', text: 'MP4 (H.264/H.265), WebM, GIF animado ou só o áudio, com predefinições para cada rede social.' },
  { icon: 'sparkles', title: 'IA opcional', text: 'Transcrição, melhores trechos e remoção de silêncio quando você conecta um provedor. Sem provedor, nada é simulado.' },
  { icon: 'history', title: 'Versões e histórico', text: 'Marcos nomeados, restauração reversível e replay passo a passo de tudo o que você editou.' },
  { icon: 'cloud', title: 'Salvamento automático', text: 'Edições gravadas na hora, com rascunho local e recuperação quando a conexão cai.' },
];

export const DIFFERENTIALS: Feature[] = [
  { icon: 'check', title: 'Revisão do projeto', text: 'Uma nota de 0 a 100 e verificações com correção em um clique: espaços vazios, legendas rápidas, mídia ampliada, volume e contraste.' },
  { icon: 'layout', title: 'Plataformas de destino', text: 'Veja no preview as áreas que a interface de Shorts, Reels ou TikTok vai cobrir antes de publicar.' },
  { icon: 'gauge', title: 'Mapa de ritmo', text: 'Duração média dos planos, cortes por minuto e trechos parados — para saber se a edição está prendendo a atenção.' },
  { icon: 'shuffle', title: 'Montagem no ritmo', text: 'Marque as batidas e deixe o editor refazer a faixa com um plano por intervalo.' },
  { icon: 'clock', title: 'Encaixar na duração', text: 'Precisa de exatamente 60 segundos? A velocidade dos clipes é ajustada por igual para fechar o tempo.' },
  { icon: 'list', title: 'EDL, CSV e roteiro', text: 'Leve a montagem para outros programas com EDL, planilha da timeline, roteiro com tempos e descrição pronta.' },
  { icon: 'flag', title: 'Tarefas na linha do tempo', text: 'Anote o que falta em cada ponto do vídeo; cada tarefa vira um marcador na régua.' },
  { icon: 'eye', title: 'Simulador de daltonismo', text: 'Confira como o vídeo aparece para quem não distingue vermelho, verde ou azul.' },
];

export const STEPS: Array<{ n: number; title: string; text: string }> = [
  { n: 1, title: 'Crie sua conta', text: 'Cadastro rápido com e-mail e senha. Nada para baixar ou instalar.' },
  { n: 2, title: 'Importe e monte', text: 'Arraste vídeos, imagens e áudios para a biblioteca e monte na timeline com atalhos de teclado e a paleta de comandos (Ctrl+K).' },
  { n: 3, title: 'Revise e exporte', text: 'Passe pela Revisão, escolha a predefinição da plataforma e baixe o arquivo renderizado no servidor.' },
];

export const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Preciso instalar algum programa?', a: 'Não. O editor roda no navegador (testado no Google Chrome). A exportação final é renderizada no servidor com FFmpeg.' },
  { q: 'Onde ficam meus vídeos e projetos?', a: 'No servidor, ligados à sua conta e isolados dos demais usuários. O projeto é salvo automaticamente e há um rascunho local para quando a conexão cai.' },
  { q: 'A inteligência artificial é obrigatória?', a: 'Não. Os recursos de IA só funcionam quando o administrador conecta um provedor; sem ele, o editor avisa com clareza em vez de simular um resultado.' },
  { q: 'A prévia é igual ao arquivo exportado?', a: 'Foi desenhada para ser: prévia e exportação usam as mesmas definições de efeitos e texto, e os testes comparam o arquivo final com a prévia.' },
  { q: 'Qual a resolução máxima de exportação?', a: 'Até 4K UHD. GIFs são limitados a 30 segundos e 720p para proteger o servidor.' },
  { q: 'Funciona no celular?', a: 'A interface foi pensada para computador (mouse e teclado). Em telas pequenas as propriedades viram uma gaveta, mas a edição por toque ainda não foi validada.' },
];

export interface Stat {
  value: string;
  label: string;
}

/** Números reais do editor, lidos direto do código (efeitos, transições, animações, plataformas e verificações). */
export function liveStats(): Stat[] {
  return [
    { value: String(EFFECTS.length), label: 'efeitos de imagem' },
    { value: String(BUILTIN_LUTS.length), label: 'LUTs de cor prontas' },
    { value: String(TRANSITION_TYPES.length), label: 'transições' },
    { value: String(ANIMATION_PRESETS.length), label: 'animações prontas' },
    { value: String(Object.keys(RULE_TITLE).length), label: 'verificações na revisão' },
    { value: String(PLATFORMS.length), label: 'plataformas de destino' },
  ];
}
