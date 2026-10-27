import type { Marker } from './schema';

/** Formata segundos como m:ss (ou h:mm:ss quando passa de uma hora), como o YouTube espera nos capítulos. */
export function chapterTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Converte marcadores em uma lista de capítulos ("0:00 Introdução"), um por linha.
 * O YouTube só reconhece capítulos se o primeiro estiver em 0:00 e houver pelo menos três, separados por 10 s ou mais;
 * por isso o primeiro capítulo é ancorado em 0:00 e marcadores a menos de 10 s do anterior são omitidos.
 */
export function markersToChapters(markers: Pick<Marker, 'time' | 'label'>[], opts: { minGap?: number } = {}): string {
  const minGap = opts.minGap ?? 10;
  const sorted = [...markers].sort((a, b) => a.time - b.time);
  const out: Array<{ time: number; label: string }> = [];
  sorted.forEach((m, i) => {
    const time = out.length === 0 ? 0 : m.time;
    if (out.length > 0 && time - out[out.length - 1]!.time < minGap) return;
    out.push({ time, label: m.label.trim() || `Capítulo ${i + 1}` });
  });
  return out.map((c) => `${chapterTime(c.time)} ${c.label}`).join('\n');
}
