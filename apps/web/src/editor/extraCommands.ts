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
