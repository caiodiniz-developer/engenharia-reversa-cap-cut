import * as core from '@editor/core';
import { findClip } from '@editor/core';
import type { Project } from '@editor/core';
import type { IconName } from '../components/Icon';
import { useEditor } from '../store/editor';
import { toast } from '../store/toasts';
import type { Command } from './commands';

/** Peças comuns dos comandos da paleta: acesso ao store, seleção, faixa em foco e execução pelo histórico. */
export const s = (): ReturnType<typeof useEditor.getState> => useEditor.getState();
export const sel = () => s().selection;
export const hasSel = () => sel().length > 0;
export const atLeast = (n: number) => () => sel().length >= n;
export const pt = (n: number) => String(n).replace('.', ',');

/** Faixa em foco: a selecionada ou a do primeiro clipe selecionado. */
export function focusTrackId(): string | null {
  const st = s();
  if (st.selectedTrackId) return st.selectedTrackId;
  const first = st.selection[0] ? findClip(st.project, st.selection[0]) : undefined;
  return first?.track.id ?? null;
}
export const hasTrack = () => focusTrackId() !== null;

/** Comando que aplica uma operação pura à seleção atual, pelo histórico (desfazer/refazer e avisos de erro vêm do store). */
export const onSelection = (label: string, fn: (p: Project, ids: string[]) => Project) => () => {
  s().run(label, (p) => fn(p, sel()));
};

/** Comando que aplica uma operação pura à faixa em foco. */
export const onTrack = (label: string, fn: (p: Project, trackId: string) => Project) => () => {
  const t = focusTrackId();
  if (!t) return void toast.info('Selecione uma faixa ou um clipe');
  s().run(label, (p) => fn(p, t));
};

/** Calcula o resultado fora do histórico e só registra a edição se algo mudou (evita entradas vazias no desfazer). */
export function applyCounted<R extends { project: Project }>(label: string, compute: (p: Project) => R, count: (r: R) => number, none: string, done: (n: number) => string) {
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

export function cmd(id: string, label: string, group: string, icon: IconName, run: () => void, extra: Partial<Command> = {}): Command {
  return { id, label, group, icon, run, ...extra };
}
