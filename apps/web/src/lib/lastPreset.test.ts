import { beforeEach, describe, expect, it } from 'vitest';
import { EXPORT_PRESETS, loadLastPresetId, saveLastPresetId } from './exportPresets';

beforeEach(() => localStorage.clear());

describe('última predefinição de exportação', () => {
  it('sem nada guardado não há predefinição', () => {
    expect(loadLastPresetId()).toBeUndefined();
  });

  it('guarda e devolve cada predefinição conhecida', () => {
    for (const p of EXPORT_PRESETS) {
      saveLastPresetId(p.id);
      expect(loadLastPresetId()).toBe(p.id);
    }
  });

  it('ids desconhecidos não são guardados e um id antigo que sumiu da lista é ignorado', () => {
    saveLastPresetId('youtube');
    saveLastPresetId('nao-existe');
    expect(loadLastPresetId()).toBe('youtube');
    localStorage.setItem('editor.exportPreset', 'predefinicao-removida');
    expect(loadLastPresetId()).toBeUndefined();
  });
});
