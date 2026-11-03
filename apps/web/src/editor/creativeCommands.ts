import * as core from '@editor/core';
import { findClip } from '@editor/core';
import type { Project } from '@editor/core';
import { toast } from '../store/toasts';
import type { Command } from './commands';
import { applyCounted, cmd, focusTrackId, hasSel, hasTrack, onSelection, onTrack, s, sel } from './commandKit';

/** Aplica uma operação que cria clipes novos e deixa os criados selecionados. */
const createAndSelect = (label: string, make: (p: Project, ids: string[]) => { project: Project; ids: string[] }) => () => {
  let created: string[] = [];
  const ok = s().run(label, (p) => {
    const r = make(p, sel());
    created = r.ids;
    return r.project;
  });
  if (ok && created.length) s().select(created);
};

const oneMedia = () => sel().length === 1 && findClip(s().project, sel()[0]!)?.clip.type === 'media';
const G = 'Criativo';

export function creativeEditCommands(): Command[] {
  const ramps = [
    ['slow-normal', 'Rampa de velocidade: câmera lenta → normal (0,3× → 1×)', 0.3, 1, false],
    ['normal-fast', 'Rampa de velocidade: normal → acelerado (1× → 4×)', 1, 4, false],
    ['smooth', 'Rampa de velocidade suave: lento → rápido (0,5× → 3×)', 0.5, 3, true],
  ] as const;
  return [
    ...ramps.map(([id, label, from, to, smooth]) =>
      cmd('ramp-' + id, label, G, 'gauge', createAndSelect('Rampa de velocidade', (p, ids) => core.speedRamp(p, ids[0]!, { from, to, smooth })), { enabled: oneMedia, keywords: 'velocidade slow motion câmera lenta acelerar curva timelapse' }),
    ),
    cmd('ramp-custom', 'Rampa de velocidade personalizada…', G, 'gauge', () => window.dispatchEvent(new Event('editor:open-ramp')), { shortcut: 'Alt+R', keywords: 'velocidade slow motion câmera lenta curva escolher trechos' }),
    cmd('boomerang', 'Boomerang: o clipe toca e volta em reverso', G, 'repeat', createAndSelect('Boomerang', (p, ids) => { const r = core.boomerang(p, ids[0]!); return { project: r.project, ids: [r.newId] }; }), { enabled: oneMedia, shortcut: 'Alt+B', keywords: 'ida e volta reverso loop vai e vem' }),
    ...([[0.25, 3], [0.1, 6]] as const).map(([size, times]) =>
      cmd('stutter-' + size, 'Gagueira: repetir ' + String(size).replace('.', ',') + ' s por ' + (times + 1) + '× na cabeça de reprodução', G, 'zap', createAndSelect('Gagueira', (p, ids) => core.stutter(p, ids[0]!, s().playhead, size, times)), { enabled: oneMedia, keywords: 'beat repeat glitch repetição travar eco batida' }),
    ),
    ...[0.05, 0.15].map((sec) =>
      cmd('smooth-cuts-' + sec, 'Fades de ' + String(sec * 1000) + ' ms em cada corte da faixa (anti-estalo)', G, 'wave', () => {
        const t = focusTrackId();
        if (!t) return void toast.info('Selecione uma faixa ou um clipe');
        applyCounted('Cortes suaves', (p) => core.smoothCuts(p, t, sec), (r) => r.cuts, 'Não há cortes secos (clipes encostados) nesta faixa', (n) => n + (n === 1 ? ' corte suavizado' : ' cortes suavizados'));
      }, { enabled: hasTrack, keywords: 'estalo click pop áudio emenda costura' }),
    ),
  ];
}

export function layoutCommands(): Command[] {
  const corners = [['tl', 'no canto superior esquerdo'], ['tr', 'no canto superior direito'], ['bl', 'no canto inferior esquerdo'], ['br', 'no canto inferior direito']] as const;
  return [
    ...corners.map(([corner, label]) =>
      cmd('pip-' + corner, 'Imagem dentro da imagem ' + label + ' (30%)', G, 'layout', onSelection('Imagem dentro da imagem', (p, ids) => core.pictureInPicture(p, ids[0]!, corner, 0.3)), { enabled: oneMedia, keywords: 'pip miniatura reação webcam canto sobrepor' }),
    ),
    cmd('split-side', 'Tela dividida: dois clipes lado a lado', G, 'panelRight', onSelection('Tela dividida', (p, ids) => core.splitScreen(p, [ids[0]!, ids[1]!], 'side')), { enabled: () => sel().length === 2, keywords: 'dividir tela comparação antes depois metade' }),
    cmd('split-stack', 'Tela dividida: um clipe sobre o outro', G, 'layers', onSelection('Tela dividida', (p, ids) => core.splitScreen(p, [ids[0]!, ids[1]!], 'stack')), { enabled: () => sel().length === 2, keywords: 'dividir tela comparação antes depois metade vertical' }),
  ];
}

export function syncCommands(): Command[] {
  const noun = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
  return [
    cmd('snap-markers', 'Puxar o início dos clipes selecionados para o marcador mais próximo', G, 'magnet', () => applyCounted('Encaixar nos marcadores', (p) => core.snapClipsToMarkers(p, sel(), 0.5), (r) => r.moved, 'Nenhum clipe está a menos de 0,5 s de um marcador (ou já está nele)', (n) => noun(n, 'clipe encaixado', 'clipes encaixados')), { enabled: hasSel, keywords: 'sincronizar batida alinhar imantar' }),
    cmd('stretch-marker', 'Esticar ou encurtar o clipe até o próximo marcador', G, 'stepForward', () => applyCounted('Esticar até o marcador', (p) => core.stretchToNextMarker(p, sel()), (r) => r.changed, 'Nada para ajustar: não há marcador depois do início, ou a mídia não alcança', (n) => noun(n, 'clipe ajustado', 'clipes ajustados')), { enabled: hasSel, keywords: 'duração fim marcador encaixar' }),
    cmd('stamp-markers', 'Carimbar o clipe em cada marcador', G, 'copyPlus', createAndSelect('Carimbar nos marcadores', (p, ids) => {
      const r = core.stampAtMarkers(p, ids[0]!);
      if (!r.newIds.length) throw new core.TimelineError('Nenhum marcador livre para a cópia (todos dentro do clipe ou ocupados)', 'OUT_OF_RANGE');
      return { project: r.project, ids: r.newIds };
    }), { enabled: () => sel().length === 1, keywords: 'efeito sonoro selo copiar repetir marcadores sfx' }),
    ...([['duration-asc', 'do mais curto ao mais longo'], ['duration-desc', 'do mais longo ao mais curto'], ['name', 'por nome']] as const).map(([by, label]) =>
      cmd('sort-' + by, 'Ordenar os clipes da faixa ' + label, G, 'list', onTrack('Ordenar a faixa', (p, t) => core.sortSequence(p, t, by)), { enabled: hasTrack, keywords: 'organizar ordem sequência classificar' }),
    ),
  ];
}

export function selectionCommands(): Command[] {
  const pick = (ids: string[], what: string) => {
    if (!ids.length) return void toast.info('Nenhum clipe ' + what);
    s().select(ids);
    toast.success(ids.length + (ids.length === 1 ? ' clipe selecionado' : ' clipes selecionados'));
  };
  const rules: Array<[core.SelectCriterion, string, string, number?]> = [
    ['muted', 'Selecionar clipes silenciados', 'silenciado'],
    ['effects', 'Selecionar clipes com efeitos', 'com efeitos'],
    ['keyframes', 'Selecionar clipes com keyframes', 'com keyframes'],
    ['transition', 'Selecionar clipes com transição', 'com transição'],
    ['linked', 'Selecionar clipes ligados (vídeo e áudio)', 'ligado'],
    ['grouped', 'Selecionar clipes agrupados', 'agrupado'],
    ['speed', 'Selecionar clipes com velocidade alterada', 'com velocidade alterada'],
    ['reversed', 'Selecionar clipes invertidos', 'invertido'],
    ['shorter', 'Selecionar clipes mais curtos que 1 s', 'mais curto que 1 s', 1],
    ['longer', 'Selecionar clipes mais longos que 5 s', 'mais longo que 5 s', 5],
  ];
  return [
    ...rules.map(([criterion, label, what, secs]) => cmd('select-where-' + criterion, label, 'Seleção', 'layers', () => pick(core.selectWhere(s().project, criterion, secs), what), { keywords: 'selecionar filtrar encontrar achar critério' })),
    cmd('select-invert', 'Inverter a seleção', 'Seleção', 'shuffle', () => pick(core.invertIds(s().project, sel()), 'para selecionar'), { shortcut: 'Alt+I', keywords: 'oposto contrário restante resto' }),
  ];
}

export function trackAndCaptionCommands(): Command[] {
  const trans = [['fade', 'dissolver'], ['slide-left', 'deslizar para a esquerda'], ['wipe-right', 'cortina para a direita']] as const;
  const capSel = () => sel().some((id) => findClip(s().project, id)?.clip.type === 'caption');
  return [
    ...trans.map(([type, label]) =>
      cmd('transitions-all-' + type, 'Transição em todos os cortes da faixa: ' + label + ' (0,5 s)', 'Transições', 'shuffle', () => {
        const t = focusTrackId();
        if (!t) return void toast.info('Selecione uma faixa ou um clipe');
        applyCounted('Transições na faixa', (p) => core.setTransitionsOnTrack(p, t, type, 0.5), (r) => r.applied, 'Nenhum corte aceitou a transição (precisam estar encostados e ter mais de 0,6 s)', (n) => n + (n === 1 ? ' transição aplicada' : ' transições aplicadas')) ;
      }, { enabled: hasTrack, keywords: 'todos os cortes lote aplicar' }),
    ),
    cmd('transitions-remove-all', 'Remover todas as transições da faixa', 'Transições', 'x', () => {
      const t = focusTrackId();
      if (!t) return void toast.info('Selecione uma faixa ou um clipe');
      applyCounted('Remover transições', (p) => core.removeTransitionsOnTrack(p, t), (r) => r.removed, 'A faixa não tem transições', (n) => n + (n === 1 ? ' transição removida' : ' transições removidas'));
    }, { enabled: hasTrack, keywords: 'tirar limpar lote' }),
    cmd('captions-split-long', 'Quebrar legendas longas (mais de 42 caracteres)', 'Legendas', 'captions', () => applyCounted('Quebrar legendas', (p) => core.splitLongCaptions(p, 42), (r) => r.created, 'Nenhuma legenda passa de 42 caracteres', (n) => n + (n === 1 ? ' legenda nova' : ' legendas novas')), { keywords: 'dividir linhas curtas comprida tamanho' }),
    ...([['amarelo', '#ffd60a'], ['ciano', '#22d3ee'], ['verde', '#4ade80']] as const).map(([name, color]) =>
      cmd('caption-highlight-' + name, 'Destacar a palavra falada em ' + name + ' nas legendas selecionadas', 'Legendas', 'captions', onSelection('Cor de destaque', (p, ids) => core.setCaptionHighlight(p, ids, color)), { enabled: capSel, keywords: 'karaokê cor palavra falada realce' }),
    ),
    cmd('caption-highlight-off', 'Remover o destaque da palavra falada nas legendas selecionadas', 'Legendas', 'captions', onSelection('Remover destaque', (p, ids) => core.setCaptionHighlight(p, ids, null)), { enabled: capSel }),
  ];
}

/** Todos os comandos criativos, na ordem em que aparecem na paleta. */
export function buildCreativeCommands(): Command[] {
  return [...creativeEditCommands(), ...layoutCommands(), ...syncCommands(), ...selectionCommands(), ...trackAndCaptionCommands()];
}
