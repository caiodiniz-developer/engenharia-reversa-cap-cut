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
