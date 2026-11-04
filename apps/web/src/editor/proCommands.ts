import * as core from '@editor/core';
import { findClip } from '@editor/core';
import { toast } from '../store/toasts';
import type { Command } from './commands';
import { applyCounted, atLeast, cmd, createAndSelect, focusTrackId, hasSel, hasTrack, onSelection, oneMedia, s, sel } from './commandKit';

const noun = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const kindOf = (id: string) => findClip(s().project, id)?.clip.type;
const G = 'Edição pro';

export function audioAndHoldCommands(): Command[] {
  return [
    ...[0.5, 1].map((sec) =>
      cmd('jcut-' + sec, 'J-cut: o áudio entra ' + String(sec).replace('.', ',') + ' s antes da imagem', G, 'wave', onSelection('J-cut', (p, ids) => core.jCut(p, ids[0]!, sec)), { enabled: oneMedia, keywords: 'som antecipar áudio antes corte de edição diálogo' }),
    ),
    ...[0.5, 1].map((sec) =>
      cmd('lcut-' + sec, 'L-cut: o áudio continua ' + String(sec).replace('.', ',') + ' s depois da imagem', G, 'wave', onSelection('L-cut', (p, ids) => core.lCut(p, ids[0]!, sec)), { enabled: oneMedia, keywords: 'som prolongar áudio depois corte de edição diálogo' }),
    ),
    cmd('match-volume', 'Igualar o volume dos clipes ao do primeiro selecionado', G, 'volume', onSelection('Igualar volume', core.matchVolumeToFirst), { enabled: atLeast(2), keywords: 'nivelar mesmo nível falas música' }),
    ...[1, 2, 5].map((sec) =>
      cmd('hold-last-' + sec, 'Segurar o último quadro por ' + sec + ' s', G, 'snowflake', createAndSelect('Segurar o último quadro', (p, ids) => { const r = core.holdLastFrame(p, ids[0]!, sec); return { project: r.project, ids: [r.freezeId] }; }), { enabled: oneMedia, keywords: 'congelar parar imagem final pausa quadro' }),
    ),
  ];
}

export function projectFadeCommands(): Command[] {
  const fade = (edge: 'in' | 'out', sec: number) => () =>
    applyCounted(
      edge === 'in' ? 'Abertura suave' : 'Encerramento suave',
      (p) => (edge === 'in' ? core.fadeInProject(p, sec) : core.fadeOutProject(p, sec)),
      (r) => r.affected,
      'Nenhum clipe ' + (edge === 'in' ? 'começa' : 'termina') + ' junto com o projeto',
      (n) => noun(n, 'clipe suavizado', 'clipes suavizados'),
    );
  return [
    ...[1, 2].map((sec) => cmd('project-fade-in-' + sec, 'Abertura suave: tudo o que começa o projeto aparece em ' + sec + ' s', G, 'sun', fade('in', sec), { keywords: 'fade in começo entrada início escurecer' })),
    ...[1, 2].map((sec) => cmd('project-fade-out-' + sec, 'Encerramento suave: tudo o que termina o projeto some em ' + sec + ' s', G, 'moon', fade('out', sec), { keywords: 'fade out fim final saída terminar escurecer' })),
  ];
}

export function textConvertCommands(): Command[] {
  const sel1 = (kind: string) => () => sel().length === 1 && kindOf(sel()[0]!) === kind;
  const some = (kind: string) => () => sel().some((id) => kindOf(id) === kind);
  return [
    cmd('split-text-lines', 'Dividir o texto em um texto por linha', G, 'list', createAndSelect('Dividir texto em linhas', (p, ids) => core.splitTextLines(p, ids[0]!)), { enabled: sel1('text'), keywords: 'lista aparecer um a um quebrar enter parágrafo' }),
    cmd('text-to-captions', 'Converter textos selecionados em legendas', G, 'captions', createAndSelect('Textos em legendas', (p, ids) => core.textToCaptions(p, ids)), { enabled: some('text'), keywords: 'transformar título legenda palavra' }),
    cmd('captions-to-text', 'Converter legendas selecionadas em textos', G, 'type', createAndSelect('Legendas em textos', (p, ids) => core.captionsToText(p, ids)), { enabled: some('caption'), keywords: 'transformar legenda título editar estilo' }),
    cmd('markers-captions', 'Marcar o início de cada legenda', G, 'flag', () => applyCounted('Marcar legendas', core.markersAtCaptions, (r) => r.added, 'Não há legendas novas para marcar (ou já há marcadores nelas)', (n) => noun(n, 'marcador criado', 'marcadores criados')), { keywords: 'capítulos falas navegar marcadores legendas' }),
  ];
}

export function trackAndTimingCommands(): Command[] {
  const hasWork = () => !!s().workArea;
  const pickRange = (mode: 'inside' | 'touching') => () => {
    const w = s().workArea;
    if (!w) return void toast.info('Marque o trecho com I e O primeiro');
    const ids = core.clipIdsInRange(s().project, w.start, w.end, mode);
    if (!ids.length) return void toast.info('Nenhum clipe ' + (mode === 'inside' ? 'está inteiro dentro do' : 'toca o') + ' trecho marcado');
    s().select(ids);
    toast.success(noun(ids.length, 'clipe selecionado', 'clipes selecionados'));
  };
  return [
    cmd('send-track-up', 'Mover a seleção para a faixa de cima (do mesmo tipo)', G, 'chevronUp', () => { s().run('Mover para a faixa de cima', (p) => core.sendToAdjacentTrack(p, sel(), -1).project); }, { enabled: hasSel, keywords: 'camada subir sobrepor mudar de faixa' }),
    cmd('send-track-down', 'Mover a seleção para a faixa de baixo (do mesmo tipo)', G, 'chevronDown', () => { s().run('Mover para a faixa de baixo', (p) => core.sendToAdjacentTrack(p, sel(), 1).project); }, { enabled: hasSel, keywords: 'camada descer mudar de faixa' }),
    cmd('remove-empty-tracks', 'Remover as faixas vazias', G, 'trash', () => applyCounted('Remover faixas vazias', core.removeEmptyTracks, (r) => r.removed, 'Não há faixas vazias', (n) => noun(n, 'faixa removida', 'faixas removidas')), { keywords: 'limpar organizar sem clipes' }),
    ...([['shortest', 'do mais curto'], ['longest', 'do mais longo'], ['average', 'da média']] as const).map(([mode, label]) =>
      cmd('match-duration-' + mode, 'Igualar a duração dos clipes selecionados à ' + (mode === 'average' ? 'média' : 'duração ' + label), G, 'clock', onSelection('Igualar duração', (p, ids) => core.matchDuration(p, ids, mode)), { enabled: atLeast(2), keywords: 'mesmo tempo tamanho uniformizar' }),
    ),
    ...[0.25, 0.5, 1].map((off) =>
      cmd('stagger-' + off, 'Escalonar a entrada dos clipes selecionados (' + String(off).replace('.', ',') + ' s entre cada um)', G, 'layers', onSelection('Escalonar entrada', (p, ids) => core.staggerClips(p, ids, off)), { enabled: atLeast(2), keywords: 'cascata sequência animação motion entrar um após o outro' }),
    ),
    cmd('select-in-range', 'Selecionar os clipes inteiros dentro do trecho marcado', G, 'layers', pickRange('inside'), { enabled: hasWork, keywords: 'intervalo entrada saída I O região' }),
    cmd('select-touching-range', 'Selecionar os clipes que tocam o trecho marcado', G, 'layers', pickRange('touching'), { enabled: hasWork, keywords: 'intervalo entrada saída I O região atravessam' }),
  ];
}

/** Todos os comandos de edição profissional, na ordem em que aparecem na paleta. */
export function buildProCommands(): Command[] {
  return [...audioAndHoldCommands(), ...projectFadeCommands(), ...textConvertCommands(), ...trackAndTimingCommands()];
}
