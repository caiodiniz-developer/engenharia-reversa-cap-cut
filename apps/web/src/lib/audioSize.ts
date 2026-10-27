export type AudioExportFormat = 'mp3' | 'm4a' | 'wav';

/** Taxa usada pelo servidor nos formatos comprimidos (kbit/s) — mesmo valor padrão do render. */
export const AUDIO_BITRATE_KBPS = 192;

/**
 * Tamanho aproximado, em bytes, de uma exportação só de áudio.
 * WAV é sem compressão (estéreo, 16 bits): conta exata além do cabeçalho de 44 bytes.
 * MP3/M4A usam taxa fixa de 192 kbit/s, então o resultado é próximo do real (varia pelo cabeçalho/contêiner).
 */
export function estimateAudioBytes(format: AudioExportFormat, seconds: number, sampleRate = 48000): number {
  const s = Math.max(0, seconds);
  if (format === 'wav') return Math.round(44 + s * sampleRate * 2 * 2);
  return Math.round((s * AUDIO_BITRATE_KBPS * 1000) / 8);
}
