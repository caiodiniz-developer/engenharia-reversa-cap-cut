import { findClip } from '@editor/core';
import type { IconName } from '../components/Icon';
import { saveNow } from '../store/persist';
import { useEditor, type PanelTab } from '../store/editor';
import { useTheme } from '../store/theme';
import { TOOLS } from './ToolRail';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon: IconName;
  /** Atalho exibido ao lado (apenas informativo). */
  shortcut?: string;
  /** Palavras extras para a busca. */
  keywords?: string;
  /** Falso quando o comando não faz sentido agora (ex.: sem seleção). */
  enabled?: () => boolean;
  run: () => void;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por todos os termos (sem acento, em qualquer ordem). Rótulo que começa com o termo vem primeiro. */
export function searchCommands(list: Command[], query: string): Command[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  const scored: Array<{ c: Command; score: number }> = [];
  for (const c of list) {
    const label = norm(c.label);
    const hay = `${label} ${norm(c.keywords ?? '')} ${norm(c.group)}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (label.startsWith(t)) score += 3;
      else if (label.includes(` ${t}`)) score += 2;
      else if (label.includes(t)) score += 1;
    }
    scored.push({ c, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.c);
}

export function buildCommands(ctx: { openPanel: (t: PanelTab) => void; onExport: () => void; onHelp: () => void; goHome: () => void }): Command[] {
  const s = () => useEditor.getState();
  const hasSel = () => s().selection.length > 0;
  const oneMedia = () => {
    const st = s();
    return st.selection.length === 1 && findClip(st.project, st.selection[0]!)?.clip.type === 'media';
  };
  const cmds: Command[] = [
    { id: 'play', label: 'Reproduzir / pausar', group: 'Reprodução', icon: 'play', shortcut: 'Espaço', run: () => s().togglePlay() },
    { id: 'start', label: 'Ir para o início', group: 'Reprodução', icon: 'skipBack', shortcut: 'Home', run: () => (s().setPlaying(false), s().setPlayhead(0)) },
    { id: 'prev-edit', label: 'Ir para o corte anterior', group: 'Reprodução', icon: 'skipBack', shortcut: '↑', keywords: 'borda marcador', run: () => s().jumpToEdit(-1) },
    { id: 'next-edit', label: 'Ir para o próximo corte', group: 'Reprodução', icon: 'skipForward', shortcut: '↓', keywords: 'borda marcador', run: () => s().jumpToEdit(1) },
    { id: 'loop', label: 'Alternar repetição', group: 'Reprodução', icon: 'repeat', run: () => s().toggleLoop() },
    { id: 'split', label: 'Dividir clipe na cabeça de reprodução', group: 'Edição', icon: 'scissors', shortcut: 'S', keywords: 'cortar', run: () => s().splitAtPlayhead() },
    { id: 'trim-start', label: 'Aparar início até a cabeça de reprodução', group: 'Edição', icon: 'scissors', shortcut: 'Q', keywords: 'cortar recortar', run: () => s().trimToPlayhead('start') },
    { id: 'trim-end', label: 'Aparar fim até a cabeça de reprodução', group: 'Edição', icon: 'scissors', shortcut: 'W', keywords: 'cortar recortar', run: () => s().trimToPlayhead('end') },
    { id: 'nudge-left', label: 'Empurrar seleção 1 quadro para trás', group: 'Edição', icon: 'stepBack', shortcut: 'Alt+←', enabled: hasSel, run: () => s().nudgeSelection(-1) },
    { id: 'nudge-right', label: 'Empurrar seleção 1 quadro para frente', group: 'Edição', icon: 'stepForward', shortcut: 'Alt+→', enabled: hasSel, run: () => s().nudgeSelection(1) },
    { id: 'delete', label: 'Excluir seleção', group: 'Edição', icon: 'trash', shortcut: 'Delete', enabled: hasSel, run: () => s().deleteSelection(false) },
    { id: 'ripple', label: 'Excluir e fechar o espaço', group: 'Edição', icon: 'trash', shortcut: 'Shift+Delete', enabled: hasSel, keywords: 'ripple', run: () => s().deleteSelection(true) },
    { id: 'duplicate', label: 'Duplicar seleção', group: 'Edição', icon: 'copy', shortcut: 'Ctrl+D', enabled: hasSel, run: () => s().duplicateSelection() },
    { id: 'copy', label: 'Copiar', group: 'Edição', icon: 'copy', shortcut: 'Ctrl+C', enabled: hasSel, run: () => s().copySelection() },
    { id: 'paste', label: 'Colar no cursor', group: 'Edição', icon: 'copyPlus', shortcut: 'Ctrl+V', run: () => s().pasteClipboard() },
    { id: 'undo', label: 'Desfazer', group: 'Edição', icon: 'undo', shortcut: 'Ctrl+Z', run: () => s().undo() },
    { id: 'redo', label: 'Refazer', group: 'Edição', icon: 'redo', shortcut: 'Ctrl+Shift+Z', run: () => s().redo() },
    { id: 'group', label: 'Agrupar clipes', group: 'Edição', icon: 'group', shortcut: 'Ctrl+G', enabled: () => s().selection.length > 1, run: () => s().group(s().selection) },
    { id: 'extract', label: 'Extrair áudio do vídeo', group: 'Edição', icon: 'mic', enabled: oneMedia, run: () => s().extractAudioOf(s().selection[0]!) },
    { id: 'freeze', label: 'Congelar quadro', group: 'Edição', icon: 'snowflake', enabled: oneMedia, run: () => s().freeze(s().selection[0]!) },
    { id: 'marker', label: 'Adicionar marcador', group: 'Timeline', icon: 'flag', shortcut: 'M', run: () => s().addMarkerAtPlayhead() },
    { id: 'snap', label: 'Alternar ímã (snap)', group: 'Timeline', icon: 'magnet', shortcut: 'N', keywords: 'encaixe', run: () => s().toggleSnapping() },
    { id: 'zoom-in', label: 'Aumentar zoom da timeline', group: 'Timeline', icon: 'zoomIn', shortcut: '+', run: () => s().setZoom(s().zoom * 1.3) },
    { id: 'zoom-out', label: 'Diminuir zoom da timeline', group: 'Timeline', icon: 'zoomOut', shortcut: '-', run: () => s().setZoom(s().zoom / 1.3) },
    { id: 'fit', label: 'Ajustar timeline à janela', group: 'Timeline', icon: 'maximize', shortcut: 'Shift+Z', keywords: 'zoom caber', run: () => s().fitTimeline() },
    { id: 'select-after', label: 'Selecionar clipes à direita da cabeça', group: 'Timeline', icon: 'layers', keywords: 'depois seguintes', run: () => s().selectSide('after') },
    { id: 'select-before', label: 'Selecionar clipes à esquerda da cabeça', group: 'Timeline', icon: 'layers', keywords: 'antes anteriores', run: () => s().selectSide('before') },
    { id: 'select-all', label: 'Selecionar todos os clipes', group: 'Timeline', icon: 'layers', shortcut: 'Ctrl+A', run: () => s().select(s().project.tracks.flatMap((t) => t.clips.map((c) => c.id))) },
    ...(['video', 'audio', 'text', 'caption'] as const).map((k) => ({
      id: `track-${k}`,
      label: `Adicionar faixa de ${{ video: 'vídeo', audio: 'áudio', text: 'texto', caption: 'legendas' }[k]}`,
      group: 'Timeline',
      icon: 'plus' as IconName,
      run: () => s().addTrack(k),
    })),
    { id: 'remove-track', label: 'Remover faixa selecionada', group: 'Timeline', icon: 'trash', enabled: () => !!s().selectedTrackId, run: () => s().removeTrack(s().selectedTrackId!) },
    { id: 'close-gaps', label: 'Fechar espaços vazios da faixa selecionada', group: 'Timeline', icon: 'minimize', enabled: () => !!s().selectedTrackId, run: () => s().closeGaps(s().selectedTrackId!) },
    { id: 'guides', label: 'Mostrar/ocultar guias de composição', group: 'Preview', icon: 'grid', run: () => s().toggleGuides() },
    { id: 'mute', label: 'Silenciar/ativar o som do preview', group: 'Preview', icon: 'volumeOff', run: () => s().toggleMute() },
    { id: 'save', label: 'Salvar agora', group: 'Projeto', icon: 'cloud', shortcut: 'Ctrl+S', run: () => void saveNow() },
    { id: 'export', label: 'Exportar vídeo…', group: 'Projeto', icon: 'download', keywords: 'renderizar baixar mp4', run: ctx.onExport },
    { id: 'home', label: 'Voltar aos projetos', group: 'Projeto', icon: 'home', run: ctx.goHome },
    { id: 'theme', label: 'Alternar tema claro/escuro', group: 'Aparência', icon: 'sun', keywords: 'dark light modo', run: () => useTheme.getState().toggle() },
    { id: 'help', label: 'Mostrar atalhos de teclado', group: 'Ajuda', icon: 'keyboard', shortcut: '?', run: ctx.onHelp },
    ...TOOLS.map((t) => ({ id: `open-${t.id}`, label: `Abrir painel: ${t.label}`, group: 'Painéis', icon: t.icon, keywords: t.title, run: () => ctx.openPanel(t.id) })),
  ];
  return cmds;
}
