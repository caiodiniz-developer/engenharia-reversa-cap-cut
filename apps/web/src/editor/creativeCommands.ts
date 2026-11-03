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
    cmd('boomerang', 'Boomerang: o clipe toca e volta em reverso', G, 'repeat', createAndSelect('Boomerang', (p, ids) => { const r = core.boomerang(p, ids[0]!); return { project: r.project, ids: [r.newId] }; }), { enabled: oneMedia, keywords: 'ida e volta reverso loop vai e vem' }),
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
