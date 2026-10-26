import { describe, expect, it } from 'vitest';
import { EXPORT_PRESETS, getExportPreset, matchPreset } from './exportPresets';

describe('predefinições de exportação', () => {
  it('têm ids únicos e rótulos em português', () => {
    expect(new Set(EXPORT_PRESETS.map((p) => p.id)).size).toBe(EXPORT_PRESETS.length);
    for (const p of EXPORT_PRESETS) expect(p.label.length).toBeGreaterThan(3);
  });

  it('o GIF respeita os limites do servidor (até 720p, nada de 1080p ou 4K)', () => {
    for (const p of EXPORT_PRESETS.filter((x) => x.kind === 'gif')) expect(['480', '720']).toContain(p.res);
  });

  it('o master 4K usa H.265 com qualidade alta e o WhatsApp é compacto', () => {
    expect(getExportPreset('master')).toMatchObject({ codec: 'h265', res: '2160', crf: '18' });
    expect(getExportPreset('whatsapp')).toMatchObject({ res: '480', crf: '26' });
  });

  it('matchPreset reconhece uma predefinição e devolve custom quando o usuário muda algo', () => {
    const yt = getExportPreset('youtube')!;
    expect(matchPreset(yt)).toBe('youtube');
    expect(matchPreset({ ...yt, crf: '26' })).toBe('custom');
    expect(matchPreset(getExportPreset('podcast')!)).toBe('podcast');
    expect(matchPreset({ ...getExportPreset('podcast')!, audioFormat: 'wav' })).toBe('custom');
    expect(matchPreset({ ...getExportPreset('gif')!, fps: '15' })).toBe('custom');
  });
});
