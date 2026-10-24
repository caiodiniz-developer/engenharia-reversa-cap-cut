import type { PlayerEngine } from './player';

/** O motor de reprodução da tela aberta (usado pela gravação local do rascunho). */
let current: PlayerEngine | null = null;

export const setEngine = (e: PlayerEngine | null): void => {
  current = e;
};
export const getEngine = (): PlayerEngine | null => current;
