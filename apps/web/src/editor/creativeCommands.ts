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
