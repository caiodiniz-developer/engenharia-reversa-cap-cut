import * as core from '@editor/core';
import { findClip } from '@editor/core';
import type { Project } from '@editor/core';
import type { IconName } from '../components/Icon';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';
import type { Command } from './commands';

const s = () => useEditor.getState();
const sel = () => s().selection;
const hasSel = () => sel().length > 0;
const atLeast = (n: number) => () => sel().length >= n;
const pt = (n: number) => String(n).replace('.', ',');

/** Faixa em foco: a selecionada ou a do primeiro clipe selecionado. */
function focusTrackId(): string | null {
  const st = s();
  if (st.selectedTrackId) return st.selectedTrackId;
  const first = st.selection[0] ? findClip(st.project, st.selection[0]) : undefined;
  return first?.track.id ?? null;
}
const hasTrack = () => focusTrackId() !== null;

/** Comando que aplica uma operação pura à seleção atual, pelo histórico (desfazer/refazer e avisos de erro vêm do store). */
const onSelection = (label: string, fn: (p: Project, ids: string[]) => Project) => () => {
  s().run(label, (p) => fn(p, sel()));
};

/** Comando que aplica uma operação pura à faixa em foco. */
const onTrack = (label: string, fn: (p: Project, trackId: string) => Project) => () => {
  const t = focusTrackId();
  if (!t) return void toast.info('Selecione uma faixa ou um clipe');
  s().run(label, (p) => fn(p, t));
};

/** Calcula o resultado fora do histórico e só registra a edição se algo mudou (evita entradas vazias no desfazer). */
function applyCounted<R extends { project: Project }>(label: string, compute: (p: Project) => R, count: (r: R) => number, none: string, done: (n: number) => string) {
  let r: R;
  try {
    r = compute(s().project);
  } catch (e) {
    if (e instanceof core.TimelineError) return void toast.error(e.message);
    throw e;
  }
  const n = count(r);
  if (!n) return void toast.info(none);
  if (s().run(label, () => r.project)) toast.success(done(n));
}

function cmd(id: string, label: string, group: string, icon: IconName, run: () => void, extra: Partial<Command> = {}): Command {
  return { id, label, group, icon, run, ...extra };
}

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
    cmd('vol-up', 'Aumentar o volume da seleção em 3 dB', G, 'volume', onSelection('Aumentar volume', (p, ids) => core.adjustVolumeDb(p, ids, 3)), { ...en, keywords: 'som mais alto decibel' }),
    cmd('vol-down', 'Diminuir o volume da seleção em 3 dB', G, 'volume', onSelection('Diminuir volume', (p, ids) => core.adjustVolumeDb(p, ids, -3)), { ...en, keywords: 'som mais baixo decibel' }),
    cmd('mute-sel', 'Silenciar o som da seleção', G, 'volumeOff', onSelection('Silenciar', (p, ids) => core.setMuted(p, ids, true)), en),
    cmd('unmute-sel', 'Reativar o som da seleção', G, 'volume', onSelection('Reativar som', (p, ids) => core.setMuted(p, ids, false)), en),
    ...[0.5, 1, 2].map((f) => cmd('fade-' + f, 'Fade de áudio de ' + pt(f) + ' s (entrada e saída)', G, 'wave', onSelection('Fade de áudio', (p, ids) => core.setFades(p, ids, f, f)), { ...en, keywords: 'aparecer sumir suave' })),
    cmd('fade-off', 'Remover os fades de áudio da seleção', G, 'wave', onSelection('Remover fades', (p, ids) => core.setFades(p, ids, 0, 0)), en),
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
