import { useEffect, useState } from 'react';
import { waveforms } from '../../lib/idb';

const memory = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[] | undefined>>();

/** Carrega a forma de onda (picos 0..1) da mídia: memória → IndexedDB → servidor. */
export function useWaveform(mediaId: string | undefined, url: string | null | undefined): number[] | undefined {
  const [peaks, setPeaks] = useState<number[] | undefined>(mediaId ? memory.get(mediaId) : undefined);

  useEffect(() => {
    if (!mediaId || !url) return;
    const cached = memory.get(mediaId);
    if (cached) return setPeaks(cached);
    let alive = true;
    let p = inflight.get(mediaId);
    if (!p) {
      p = (async () => {
        const local = await waveforms.get(mediaId);
        if (local) return local;
        try {
          const res = await fetch(url);
          if (!res.ok) return undefined;
          const data = (await res.json()) as number[];
          void waveforms.save(mediaId, data);
          return data;
        } catch {
          return undefined;
        }
      })();
      inflight.set(mediaId, p);
    }
    void p.then((d) => {
      inflight.delete(mediaId);
      if (d) memory.set(mediaId, d);
      if (alive) setPeaks(d);
    });
    return () => {
      alive = false;
    };
  }, [mediaId, url]);

  return peaks;
}
