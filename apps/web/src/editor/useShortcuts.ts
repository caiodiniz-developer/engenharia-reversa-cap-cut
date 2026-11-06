import { useEffect } from 'react';
import { projectDuration } from '@editor/core';
import { saveNow } from '../store/persist';
import { useEditor } from '../store/editor';
import { buildCreativeCommands } from './creativeCommands';
import { buildProCommands } from './proCommands';

export { SHORTCUTS, type Shortcut } from './shortcuts';

const isTyping = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

/** Atalhos globais do editor. Ignora teclas digitadas em campos de formulário. */
export function useShortcuts(openHelp: () => void, openPalette: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 's') {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (mod && key === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (isTyping(e.target)) return;
      const target = e.target as HTMLElement;
      // Em diálogos o teclado pertence ao diálogo.
      if (target.closest?.('[role="dialog"]')) return;
      // Enter é do controle focado. Espaço é "reproduzir/pausar" em qualquer lugar do editor
      // (como nos editores de vídeo): tira o foco do botão para não acioná-lo também.
      if (e.key === 'Enter' && target.closest?.('button, [role="button"], a, [role="tab"], [role="menuitem"], [role="radio"]')) return;
      if (e.key === ' ' && target.closest?.('button')) (target as HTMLElement).blur();

      if (mod && key === 'z') {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && e.altKey && key === 'c') {
        e.preventDefault();
        s.copySelectionAttributes();
      } else if (mod && e.altKey && key === 'v') {
        e.preventDefault();
        s.pasteSelectionAttributes();
      } else if (mod && key === 'c') {
        s.copySelection();
      } else if (mod && key === 'v') {
        e.preventDefault();
        s.pasteClipboard();
      } else if (mod && key === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (mod && key === 'a') {
        e.preventDefault();
        s.select(s.project.tracks.flatMap((t) => t.clips.map((c) => c.id)));
      } else if (mod && key === 'g') {
        e.preventDefault();
        e.shiftKey ? s.ungroup(s.selection) : s.group(s.selection);
      } else if (mod) {
        return;
      } else if (e.altKey && (key === 'i' || key === 'b' || key === 'r' || key === 'j' || key === 'l' || key === 'h')) {
        // antes das teclas simples: I (marcar entrada) e outras também casariam com Alt pressionado
        e.preventDefault();
        const id = { i: 'select-invert', b: 'boomerang', r: 'ramp-custom', j: 'jcut-1', l: 'lcut-1', h: 'hold-last-2' }[key];
        const c = [...buildCreativeCommands(), ...buildProCommands()].find((x) => x.id === id);
        if (c && (c.enabled?.() ?? true)) c.run();
      } else if (e.key === ' ') {
        e.preventDefault();
        s.togglePlay();
      } else if (key === 's') {
        s.splitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteSelection(e.shiftKey);
      } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const step = e.shiftKey ? s.project.settings.fps : 1;
        s.nudgeSelection(e.key === 'ArrowLeft' ? -step : step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.shiftKey ? s.setPlayhead(s.playhead - 1) : s.stepFrames(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.shiftKey ? s.setPlayhead(s.playhead + 1) : s.stepFrames(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        s.jumpToEdit(e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'Home') {
        s.setPlaying(false);
        s.setPlayhead(0);
      } else if (e.key === 'End') {
        s.setPlaying(false);
        s.setPlayhead(projectDuration(s.project));
      } else if (key === 'z' && e.shiftKey) {
        s.fitTimeline();
      } else if (key === 'f' && !e.shiftKey && !e.altKey) {
        s.toggleFocusMode();
      } else if (key === 'f' && e.shiftKey) {
        s.zoomToSelection();
      } else if (key === 'r' && e.shiftKey) {
        s.rotateSelection(90);
      } else if (e.key === '[') {
        s.stepRate(-1);
      } else if (e.key === ']') {
        s.stepRate(1);
      } else if (key === 'i') {
        s.markWorkArea('start');
      } else if (key === 'o') {
        s.markWorkArea('end');
      } else if (e.altKey && key === 'x') {
        s.clearWorkArea();
      } else if (key === 'q') {
        s.trimToPlayhead('start');
      } else if (key === 'w') {
        s.trimToPlayhead('end');
      } else if (key === 'm') {
        s.addMarkerAtPlayhead();
      } else if (key === 'n') {
        s.toggleSnapping();
      } else if (e.key === '+' || e.key === '=') {
        s.setZoom(s.zoom * 1.3);
      } else if (e.key === '-' || e.key === '_') {
        s.setZoom(s.zoom / 1.3);
      } else if (e.key === 'Escape') {
        s.select([]);
      } else if (e.key === '?') {
        openHelp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, openPalette]);
}
