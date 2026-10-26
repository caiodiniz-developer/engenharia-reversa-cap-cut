export type ExportKind = 'video' | 'audio' | 'gif';
export type ExportCodec = 'h264' | 'h265' | 'vp9';
export type ExportRes = 'project' | '2160' | '1080' | '720' | '480';
export type ExportAudioFormat = 'mp3' | 'm4a' | 'wav';

export interface ExportPreset {
  id: string;
  label: string;
  description: string;
  kind: ExportKind;
  codec: ExportCodec;
  res: ExportRes;
  /** 'project' mantém os quadros por segundo do projeto. */
  fps: 'project' | '12' | '15' | '24' | '30' | '60';
  crf: '18' | '21' | '26';
  audioFormat: ExportAudioFormat;
}

const base = { codec: 'h264', res: 'project', fps: 'project', crf: '21', audioFormat: 'mp3' } as const;

/** Combinações prontas do diálogo de exportação. O usuário pode ajustar qualquer campo depois. */
export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'youtube', label: 'YouTube · Full HD', description: 'MP4 H.264, 1080p, qualidade equilibrada', kind: 'video', ...base, res: '1080' },
  { id: 'social', label: 'Redes sociais · 1080p', description: 'MP4 H.264 compatível com Instagram, TikTok e Shorts', kind: 'video', ...base, res: '1080', fps: '30' },
  { id: 'whatsapp', label: 'WhatsApp · leve', description: 'MP4 H.264 480p compacto para enviar por mensagem', kind: 'video', ...base, res: '480', crf: '26' },
  { id: 'master', label: 'Master · 4K', description: 'MP4 H.265 em 4K com qualidade alta', kind: 'video', ...base, codec: 'h265', res: '2160', crf: '18' },
  { id: 'web', label: 'Web · WebM', description: 'WebM VP9 720p para sites', kind: 'video', ...base, codec: 'vp9', res: '720' },
  { id: 'gif', label: 'GIF curto', description: 'GIF animado 480p a 12 quadros/s (até 30 s)', kind: 'gif', ...base, res: '480', fps: '12' },
  { id: 'podcast', label: 'Áudio · MP3', description: 'Somente o áudio mixado em MP3', kind: 'audio', ...base, audioFormat: 'mp3' },
];

export const getExportPreset = (id: string): ExportPreset | undefined => EXPORT_PRESETS.find((p) => p.id === id);

/** Se os campos atuais coincidem com alguma predefinição, devolve o id dela (para mostrar no seletor). */
export function matchPreset(cur: Pick<ExportPreset, 'kind' | 'codec' | 'res' | 'fps' | 'crf' | 'audioFormat'>): string {
  const hit = EXPORT_PRESETS.find((p) => {
    if (p.kind !== cur.kind) return false;
    if (p.kind === 'audio') return p.audioFormat === cur.audioFormat;
    if (p.kind === 'gif') return p.res === cur.res && p.fps === cur.fps;
    return p.codec === cur.codec && p.res === cur.res && p.fps === cur.fps && p.crf === cur.crf;
  });
  return hit?.id ?? 'custom';
}
