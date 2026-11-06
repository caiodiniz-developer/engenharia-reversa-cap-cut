import * as core from '@editor/core';
import { findClip } from '@editor/core';
import type { Project } from '@editor/core';
import type { IconName } from '../components/Icon';
import { ACCENTS, ACCENT_LABEL, GLASS_LABEL } from '../lib/appearance';
import { useAppearance } from '../store/appearance';
import { toast } from '../store/toasts';
import type { Command } from './commands';
import { buildCreativeCommands } from './creativeCommands';
import { buildProCommands } from './proCommands';
import { applyCounted, atLeast, cmd, focusTrackId, hasSel, hasTrack, onSelection, onTrack, pt, s, sel } from './commandKit';

export function arrangeCommands(): Command[] {
  const G = 'Organização';
  const media = (id: string) => findClip(s().project, id)?.clip.type === 'media';
  const oneMedia = () => sel().length === 1 && media(sel()[0]!);
  const hasWork = () => !!s().workArea;
  return [
    cmd('reverse-seq', 'Inverter a ordem dos clipes da faixa', G, 'rewind', onTrack('Inverter a ordem', core.reverseSequence), { enabled: hasTrack, keywords: 'trás para frente sequência reverter' }),
    cmd('shuffle-seq', 'Embaralhar a ordem dos clipes da faixa', G, 'shuffle', onTrack('Embaralhar a ordem', (p, t) => core.shuffleSequence(p, t, Math.floor(Math.random() * 1_000_000))), { enabled: hasTrack, keywords: 'aleatório misturar sortear' }),
    ...(
      [
        ['start', 'pelo início', 'Alinhar'],
        ['end', 'pelo fim', 'Alinhar'],
        ['center', 'pelo centro', 'Alinhar'],
      ] as const
    ).map(([mode, label]) => cmd('align-' + mode, 'Alinhar clipes selecionados ' + label, G, 'layers', onSelection('Alinhar ' + label, (p, ids) => core.alignClips(p, ids, mode)), { enabled: atLeast(2), keywords: 'empilhar' })),
    cmd('distribute', 'Distribuir clipes selecionados com vãos iguais', G, 'grip', onSelection('Distribuir clipes', core.distributeClips), { enabled: atLeast(3), keywords: 'espaçamento uniforme' }),
    ...([[0, 'encostados (sem vão)'], [0.5, 'com vão de 0,5 s'], [1, 'com vão de 1 s']] as const).map(([gap, label]) =>
      cmd('space-' + gap, 'Espaçar clipes selecionados ' + label, G, 'minus', onSelection('Espaçar clipes', (p, ids) => core.spaceClips(p, ids, gap)), { enabled: atLeast(2), keywords: 'intervalo' }),
    ),
    ...[1, 2, 5, 10].map((n) =>
      cmd('split-every-' + n, 'Dividir o clipe a cada ' + n + ' s', G, 'scissors', () => {
        const id = sel()[0]!;
        let ids: string[] = [];
        const ok = s().run('Dividir a cada ' + n + ' s', (p) => {
          const r = core.splitEvery(p, id, n);
          ids = r.ids;
          return r.project;
        });
        if (ok && ids.length > 1) s().select(ids);
        else if (ok) toast.info('O clipe é mais curto que ' + n + ' s: nada para dividir');
      }, { enabled: () => sel().length === 1, keywords: 'cortar fatiar intervalo' }),
    ),
    ...[2, 3, 4, 5, 10].map((n) =>
      cmd('split-parts-' + n, 'Dividir o clipe em ' + n + ' partes iguais', G, 'scissors', () => {
        const id = sel()[0]!;
        let ids: string[] = [];
        if (s().run('Dividir em ' + n + ' partes', (p) => {
          const r = core.splitIntoParts(p, id, n);
          ids = r.ids;
          return r.project;
        })) s().select(ids);
      }, { enabled: () => sel().length === 1, keywords: 'cortar fatiar metade terço' }),
    ),
    cmd('join-contiguous', 'Juntar pedaços contínuos da faixa', G, 'link', () => {
      const t = focusTrackId();
      if (!t) return void toast.info('Selecione uma faixa ou um clipe');
      applyCounted('Juntar pedaços', (p) => core.joinContiguous(p, t), (r) => r.merged, 'Não há pedaços contínuos iguais para juntar', (n) => n + (n === 1 ? ' junção feita' : ' junções feitas'));
    }, { enabled: hasTrack, keywords: 'unir mesclar desfazer divisão' }),
    cmd('snap-grid', 'Encaixar todos os clipes na grade de quadros', G, 'magnet', () => applyCounted('Encaixar na grade de quadros', core.snapToFrameGrid, (r) => r.changed, 'Todos os clipes já estão na grade de quadros', (n) => n + (n === 1 ? ' clipe ajustado' : ' clipes ajustados')), { keywords: 'arredondar frame sincronizar' }),
    ...[1, 2, 5].map((n) =>
      cmd('gap-' + n, 'Abrir espaço de ' + n + ' s na cabeça de reprodução', G, 'plus', () => void s().run('Abrir espaço de ' + n + ' s', (p) => core.insertGap(p, s().playhead, n)), { keywords: 'inserir vazio afastar' }),
    ),
    cmd('cut-range', 'Remover o trecho marcado de todas as faixas', G, 'scissors', () => {
      const w = s().workArea;
      if (!w) return;
      if (s().run('Remover trecho', (p) => core.cutRange(p, w.start, w.end))) s().clearWorkArea();
    }, { enabled: hasWork, keywords: 'recortar apagar intervalo ripple tirar' }),
    cmd('loop-fill', 'Repetir o clipe até o fim do trecho marcado', G, 'repeat', () => {
      const w = s().workArea;
      if (!w) return void toast.info('Marque o fim do trecho com O');
      s().run('Repetir até preencher', (p) => core.loopToFill(p, sel()[0]!, w.end).project);
    }, { enabled: oneMedia, keywords: 'loop preencher cobrir' }),
    cmd('swap-clips', 'Trocar de lugar os dois clipes selecionados', G, 'shuffle', onSelection('Trocar clipes de lugar', (p, ids) => {
      if (ids.length !== 2) throw new core.TimelineError('Selecione exatamente dois clipes', 'OUT_OF_RANGE');
      return core.swapClips(p, ids[0]!, ids[1]!);
    }), { enabled: () => sel().length === 2, keywords: 'inverter posição permutar' }),
  ];
}

export function audioCommands(): Command[] {
  const G = 'Áudio';
  const mediaSel = () => sel().some((id) => findClip(s().project, id)?.clip.type === 'media');
  const en = { enabled: mediaSel };
  const eq = (label: string, bands: Partial<core.AudioProps['eq']>) => cmd('eq-' + label, 'Equalizador da seleção: ' + label, G, 'sliders', onSelection('Equalizador: ' + label, (p, ids) => core.setEq(p, ids, bands)), { ...en, keywords: 'graves médios agudos som' });
  return [
    ...[0, 50, 100, 150, 200].map((v) => cmd('vol-' + v, 'Volume da seleção: ' + v + '%', G, 'volume', onSelection('Volume ' + v + '%', (p, ids) => core.setVolume(p, ids, v / 100)), { ...en, keywords: 'som nível' })),
    cmd('vol-db-up', 'Aumentar o volume da seleção em 3 dB', G, 'volume', onSelection('Aumentar volume', (p, ids) => core.adjustVolumeDb(p, ids, 3)), { ...en, keywords: 'som mais alto decibel' }),
    cmd('vol-db-down', 'Diminuir o volume da seleção em 3 dB', G, 'volume', onSelection('Diminuir volume', (p, ids) => core.adjustVolumeDb(p, ids, -3)), { ...en, keywords: 'som mais baixo decibel' }),
    cmd('mute-sel', 'Silenciar o som da seleção', G, 'volumeOff', onSelection('Silenciar', (p, ids) => core.setMuted(p, ids, true)), en),
    cmd('unmute-sel', 'Reativar o som da seleção', G, 'volume', onSelection('Reativar som', (p, ids) => core.setMuted(p, ids, false)), en),
    ...([['esquerda', -1], ['centro', 0], ['direita', 1]] as const).map(([name, v]) => cmd('pan-' + name, 'Balanço da seleção: ' + name, G, 'sliders', onSelection('Balanço ' + name, (p, ids) => core.setPan(p, ids, v)), { ...en, keywords: 'estéreo lado caixa' })),
    eq('realçar graves', { bass: 6 }),
    eq('realçar voz', { bass: -2, mid: 4 }),
    eq('realçar agudos', { treble: 6 }),
    eq('zerar', { bass: 0, mid: 0, treble: 0 }),
    cmd('normalize-on', 'Normalizar o volume da seleção', G, 'gauge', onSelection('Normalizar volume', (p, ids) => core.setAudioFlags(p, ids, { normalize: true })), { ...en, keywords: 'nivelar loudness' }),
    cmd('normalize-off', 'Desligar a normalização da seleção', G, 'gauge', onSelection('Desligar normalização', (p, ids) => core.setAudioFlags(p, ids, { normalize: false })), en),
    cmd('denoise-on', 'Reduzir o ruído da seleção', G, 'mic', onSelection('Reduzir ruído', (p, ids) => core.setAudioFlags(p, ids, { denoise: true })), { ...en, keywords: 'chiado limpar' }),
    cmd('denoise-off', 'Desligar a redução de ruído da seleção', G, 'mic', onSelection('Desligar redução de ruído', (p, ids) => core.setAudioFlags(p, ids, { denoise: false })), en),
    cmd('duck', 'Abaixar a música selecionada quando outros clipes falam', G, 'wave', () => {
      const st = s();
      const music = st.selection;
      const musicTracks = new Set(music.map((id) => findClip(st.project, id)?.track.id));
      const voices = core
        .allClips(st.project)
        .filter(({ clip, track }) => clip.type === 'media' && !music.includes(clip.id) && !musicTracks.has(track.id) && !track.muted && !clip.audio.muted && st.project.media[clip.mediaId]?.hasAudio)
        .map(({ clip }) => clip.id);
      if (!voices.length) return void toast.info('Não há outros clipes com som para a música abaixar junto');
      applyCounted('Abaixar música', (p) => core.duckUnder(p, music, voices), (r) => r.ducked, 'Nenhum clipe selecionado toca ao mesmo tempo que os outros', (n) => 'Volume rebaixado em ' + n + (n === 1 ? ' clipe' : ' clipes'));
    }, { ...en, keywords: 'ducking voz narração fundo rebaixar automático' }),
  ];
}

export function frameCommands(): Command[] {
  const G = 'Quadro e movimento';
  const visual = () => sel().some((id) => findClip(s().project, id)?.clip.type !== undefined);
  const en = { enabled: visual };
  const dirs = [['esquerda', -0.05, 0], ['direita', 0.05, 0], ['cima', 0, -0.05], ['baixo', 0, 0.05]] as const;
  return [
    ...[100, 75, 50, 25].map((o) => cmd('opacity-' + o, 'Opacidade da seleção: ' + o + '%', G, 'eye', onSelection('Opacidade ' + o + '%', (p, ids) => core.setOpacity(p, ids, o / 100)), { ...en, keywords: 'transparência' })),
    ...dirs.map(([name, dx, dy]) => cmd('nudge-' + name, 'Mover a imagem 5% para ' + name, G, 'grip', onSelection('Mover para ' + name, (p, ids) => core.nudgeClips(p, ids, dx, dy)), { ...en, keywords: 'posição deslocar empurrar' })),
    cmd('scale-up', 'Ampliar a seleção em 10%', G, 'zoomIn', onSelection('Ampliar', (p, ids) => core.scaleClipsBy(p, ids, 1.1)), { ...en, keywords: 'zoom escala maior' }),
    cmd('scale-down', 'Reduzir a seleção em 10%', G, 'zoomOut', onSelection('Reduzir', (p, ids) => core.scaleClipsBy(p, ids, 0.9)), { ...en, keywords: 'zoom escala menor' }),
    ...([['90° no sentido horário', 90], ['90° no sentido anti-horário', -90], ['15° no sentido horário', 15], ['15° no sentido anti-horário', -15]] as const).map(([name, deg]) => cmd('rotate-' + deg, 'Girar a seleção ' + name, G, 'repeat', onSelection('Girar ' + name, (p, ids) => core.rotateClipsBy(p, ids, deg)), { ...en, keywords: 'rotação virar' })),
    cmd('flip-h', 'Espelhar a seleção na horizontal', G, 'shuffle', onSelection('Espelhar na horizontal', (p, ids) => core.flipClips(p, ids, 'h')), { ...en, keywords: 'inverter lado' }),
    cmd('flip-v', 'Espelhar a seleção na vertical', G, 'shuffle', onSelection('Espelhar na vertical', (p, ids) => core.flipClips(p, ids, 'v')), { ...en, keywords: 'inverter cima baixo' }),
    cmd('center', 'Centralizar a seleção no quadro', G, 'maximize', onSelection('Centralizar', core.centerClips), { ...en, keywords: 'meio posição' }),
    cmd('fill-cover', 'Preencher o quadro com a seleção (cortando as sobras)', G, 'maximize', onSelection('Preencher o quadro', (p, ids) => core.fillFrame(p, ids, 'cover')), { ...en, keywords: 'cobrir tela cheia vertical barras pretas' }),
    cmd('fill-contain', 'Encaixar a seleção inteira no quadro', G, 'minimize', onSelection('Encaixar no quadro', (p, ids) => core.fillFrame(p, ids, 'contain')), { ...en, keywords: 'caber conter' }),
    ...([['1:1 (quadrado)', 1], ['9:16 (vertical)', 9 / 16], ['16:9 (horizontal)', 16 / 9], ['4:5 (retrato)', 4 / 5]] as const).map(([name, ratio]) => cmd('crop-' + name.split(' ')[0]!.replace(':', 'x'), 'Cortar a seleção para ' + name, G, 'layout', onSelection('Cortar para ' + name, (p, ids) => core.cropToAspect(p, ids, ratio)), { ...en, keywords: 'recortar proporção aspecto' })),
    cmd('ken-in', 'Efeito Ken Burns: aproximar devagar', G, 'zoomIn', onSelection('Ken Burns (aproximar)', (p, ids) => core.kenBurns(p, ids, { zoom: 1.15, direction: 'in' })), { ...en, keywords: 'zoom lento movimento foto documentário' }),
    cmd('ken-out', 'Efeito Ken Burns: afastar devagar', G, 'zoomOut', onSelection('Ken Burns (afastar)', (p, ids) => core.kenBurns(p, ids, { zoom: 1.15, direction: 'out' })), { ...en, keywords: 'zoom lento movimento foto documentário' }),
    cmd('ken-pan', 'Efeito Ken Burns: aproximar deslizando para a direita', G, 'zoomIn', onSelection('Ken Burns (deslizar)', (p, ids) => core.kenBurns(p, ids, { zoom: 1.2, pan: 0.06 })), { ...en, keywords: 'panorâmica movimento' }),
    cmd('punch-in', 'Zoom de ênfase na cabeça de reprodução', G, 'zap', () => {
      const st = s();
      const id = st.selection[0];
      const f = id ? findClip(st.project, id) : undefined;
      if (!f) return void toast.info('Selecione um clipe');
      const at = st.playhead - f.clip.start;
      if (at < 0 || at > f.clip.duration) return void toast.info('Posicione a cabeça de reprodução sobre o clipe selecionado');
      s().run('Zoom de ênfase', (p) => core.punchIn(p, id!, at));
    }, { enabled: () => sel().length === 1, keywords: 'destaque soco impacto' }),
    cmd('shake-soft', 'Tremor de câmera leve', G, 'zap', onSelection('Tremor leve', (p, ids) => core.shakeClips(p, ids, 0.006, Math.floor(Math.random() * 99999))), { ...en, keywords: 'balançar vibrar câmera na mão' }),
    cmd('shake-strong', 'Tremor de câmera forte', G, 'zap', onSelection('Tremor forte', (p, ids) => core.shakeClips(p, ids, 0.02, Math.floor(Math.random() * 99999))), { ...en, keywords: 'balançar vibrar terremoto impacto' }),
    ...[0.5, 1].map((f) => cmd('fade-opacity-' + f, 'Aparecer e sumir com transparência (' + pt(f) + ' s)', G, 'eye', onSelection('Fade de imagem', (p, ids) => core.fadeOpacity(p, ids, f, f)), { ...en, keywords: 'fade dissolver entrada saída' })),
  ];
}

export function textCommands(): Command[] {
  const G = 'Texto';
  const textSel = () => sel().some((id) => { const t = findClip(s().project, id)?.clip.type; return t === 'text' || t === 'caption'; });
  const en = { enabled: textSel };
  /** Insere um clipe criado por uma operação na cabeça de reprodução e o seleciona. */
  const insert = (label: string, make: (p: Project, at: number) => { project: Project; id: string }) => () => {
    let id = '';
    const ok = s().run(label, (p) => {
      const r = make(p, s().playhead);
      id = r.id;
      return r.project;
    });
    if (ok) s().select([id]);
  };
  return [
    ...([['branco', '#ffffff'], ['amarelo', '#ffd60a'], ['preto', '#000000']] as const).map(([name, color]) => cmd('text-color-' + name, 'Cor do texto selecionado: ' + name, G, 'type', onSelection('Cor do texto', (p, ids) => core.setTextStyle(p, ids, { color })), { ...en, keywords: 'letra fonte' })),
    ...[48, 72, 110].map((size) => cmd('text-size-' + size, 'Tamanho do texto selecionado: ' + size, G, 'type', onSelection('Tamanho do texto', (p, ids) => core.setTextStyle(p, ids, { fontSize: size })), { ...en, keywords: 'letra fonte grande pequeno' })),
    cmd('text-outline', 'Contorno preto no texto selecionado', G, 'type', onSelection('Contorno do texto', (p, ids) => core.setTextStyle(p, ids, { strokeColor: '#000000', strokeWidth: 6 })), { ...en, keywords: 'borda legibilidade' }),
    cmd('text-no-outline', 'Remover o contorno do texto selecionado', G, 'type', onSelection('Remover contorno', (p, ids) => core.setTextStyle(p, ids, { strokeWidth: 0 })), en),
    ...([['top', 'no topo'], ['middle', 'no meio'], ['bottom', 'na base']] as const).map(([where, label]) => cmd('text-place-' + where, 'Posicionar o texto selecionado ' + label + ' do quadro', G, 'layout', onSelection('Posicionar texto', (p, ids) => core.placeText(p, ids, where)), { ...en, keywords: 'alinhar lugar' })),
    cmd('text-number', 'Numerar os textos selecionados ("Cena 1", "Cena 2"…)', G, 'list', onSelection('Numerar textos', (p, ids) => core.numberTexts(p, ids, 'Cena {n}')), { ...en, keywords: 'sequência contador capítulos' }),
    cmd('text-clean', 'Limpar espaços repetidos nos textos', G, 'wand', () => applyCounted('Limpar textos', (p) => core.cleanText(p, hasSel() ? sel() : undefined), (r) => r.changed, 'Os textos já estão limpos', (n) => n + (n === 1 ? ' texto arrumado' : ' textos arrumados')), { keywords: 'espaços em branco formatar arrumar' }),
    cmd('add-title', 'Adicionar título na cabeça de reprodução', G, 'type', insert('Adicionar título', (p, at) => { const r = core.addTitleCard(p, 'Título', at, 3); return { project: r.project, id: r.clipId }; }), { keywords: 'cartela abertura texto grande' }),
    cmd('add-lower-third', 'Adicionar terço inferior (nome e função)', G, 'type', insert('Adicionar terço inferior', (p, at) => { const r = core.addLowerThird(p, 'Nome', 'Função', at, 4); return { project: r.project, id: r.ids[0]! }; }), { keywords: 'identificação apresentador lower third' }),
    ...[3, 5].map((n) => cmd('add-countdown-' + n, 'Adicionar contagem regressiva de ' + n + ' s', G, 'clock', insert('Adicionar contagem regressiva', (p, at) => { const r = core.addCountdown(p, n, at); return { project: r.project, id: r.ids[0]! }; }), { keywords: 'contador números 3 2 1' })),
    ...([['tl', 'no canto superior esquerdo'], ['tr', 'no canto superior direito'], ['bl', 'no canto inferior esquerdo'], ['br', 'no canto inferior direito']] as const).map(([corner, label]) =>
      cmd('watermark-' + corner, 'Adicionar marca d’água ' + label, G, 'diamond', () => {
        let id = '';
        if (s().run('Adicionar marca d’água', (p) => { const r = core.addWatermark(p, p.name || 'Meu vídeo', corner); id = r.clipId; return r.project; })) s().select([id]);
      }, { keywords: 'logo assinatura canal marca' }),
    ),
    cmd('script-captions', 'Criar legendas a partir de um roteiro…', G, 'captions', () => window.dispatchEvent(new Event('editor:open-script')), { keywords: 'texto colar falas distribuir tempo' }),
  ];
}

export function markerCommands(): Command[] {
  const G = 'Marcadores e faixas';
  return [
    ...[5, 10, 30].map((n) => cmd('markers-every-' + n, 'Marcar a cada ' + n + ' s', G, 'flag', () => applyCounted('Marcadores periódicos', (p) => core.markersEvery(p, n), (r) => r.added, 'Nenhum marcador novo: já existem nessas posições ou o projeto é mais curto que o intervalo', (k) => k + (k === 1 ? ' marcador criado' : ' marcadores criados')), { keywords: 'marcador periódico intervalo' })),
    cmd('markers-clip-starts', 'Marcar o início de cada clipe', G, 'flag', () => applyCounted('Marcar inícios', (p) => core.markersAtClipStarts(p, hasSel() ? sel() : undefined), (r) => r.added, 'Já existem marcadores nos inícios dos clipes', (k) => k + (k === 1 ? ' marcador criado' : ' marcadores criados')), { keywords: 'marcador cortes capítulos' }),
    cmd('markers-gaps', 'Marcar os vãos vazios da timeline', G, 'alert', () => applyCounted('Marcar vãos', (p) => core.markersAtGaps(p), (r) => r.added, 'A timeline não tem vãos', (k) => k + (k === 1 ? ' vão marcado' : ' vãos marcados')), { keywords: 'buracos espaços vazios pretos' }),
    cmd('markers-clear', 'Apagar todos os marcadores', G, 'trash', () => {
      if (!s().project.markers.length) return void toast.info('Não há marcadores');
      s().run('Apagar marcadores', (p) => core.clearMarkers(p).project);
    }, { keywords: 'remover limpar' }),
    cmd('markers-forward', 'Deslocar todos os marcadores 1 s para frente', G, 'stepForward', () => void s().run('Deslocar marcadores', (p) => core.shiftMarkers(p, 1)), { enabled: () => s().project.markers.length > 0, keywords: 'mover atrasar' }),
    cmd('markers-back', 'Deslocar todos os marcadores 1 s para trás', G, 'stepBack', () => void s().run('Deslocar marcadores', (p) => core.shiftMarkers(p, -1)), { enabled: () => s().project.markers.length > 0, keywords: 'mover adiantar' }),
    cmd('solo-track', 'Solo: ver/ouvir só a faixa em foco', G, 'eye', onTrack('Solo da faixa', core.soloTrack), { enabled: hasTrack, keywords: 'isolar silenciar outras' }),
    cmd('show-all-tracks', 'Mostrar e reativar todas as faixas', G, 'eyeOff', () => void s().run('Mostrar todas as faixas', core.showAllTracks), { keywords: 'desfazer solo ocultar silenciar' }),
    cmd('auto-name-tracks', 'Renomear as faixas automaticamente (Vídeo 1, Áudio 1…)', G, 'pencil', () => void s().run('Renomear faixas', core.autoNameTracks), { keywords: 'nomes organizar numerar' }),
  ];
}

export function appearanceCommands(): Command[] {
  const G = 'Aparência';
  return [
    ...ACCENTS.map((a) => cmd('accent-' + a, 'Cor de destaque: ' + ACCENT_LABEL[a], G, 'sparkles', () => useAppearance.getState().setAccent(a), { keywords: 'tema cor azul violeta laranja rosa verde personalizar' })),
    ...(['glass', 'auto', 'solid'] as const).map((mode) =>
      cmd('glass-' + mode, 'Vidro: ' + GLASS_LABEL[mode], G, 'layers', () => {
        useAppearance.getState().setGlass(mode);
        toast.info(GLASS_LABEL[mode] + ': ligado');
      }, { keywords: 'transparência desfoque blur liquid glass acessibilidade sólido sistema' }),
    ),
  ];
}

export function projectCommands(): Command[] {
  const G = 'Projeto';
  return [
    cmd('whats-new', 'Novidades do editor…', G, 'sparkles', () => window.dispatchEvent(new Event('editor:open-news')), { keywords: 'o que há de novo mudanças recursos changelog atualizações' }),
    cmd('project-stats', 'Estatísticas do projeto…', G, 'info', () => window.dispatchEvent(new Event('editor:open-stats')), { keywords: 'resumo números duração quantos clipes palavras' }),
    cmd('remove-duplicates', 'Remover clipes duplicados empilhados', G, 'copy', () => applyCounted('Remover duplicados', core.removeDuplicateClips, (r) => r.removed, 'Não há clipes idênticos empilhados', (n) => n + (n === 1 ? ' duplicado removido' : ' duplicados removidos')), { keywords: 'repetidos iguais limpar' }),
    cmd('replace-media', 'Substituir uma mídia por outra…', G, 'film', () => window.dispatchEvent(new Event('editor:open-replace-media')), { keywords: 'trocar arquivo relink proxy' }),
  ];
}

/** Todos os comandos extras, na ordem em que aparecem na paleta. */
export function buildExtraCommands(): Command[] {
  return [...arrangeCommands(), ...audioCommands(), ...frameCommands(), ...textCommands(), ...markerCommands(), ...projectCommands(), ...appearanceCommands(), ...buildCreativeCommands(), ...buildProCommands()];
}
