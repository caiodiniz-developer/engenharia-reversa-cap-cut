import type { Project } from './schema';

/** Ids de mídia usados por algum clipe da timeline. */
export function usedMediaIds(p: Project): Set<string> {
  const used = new Set<string>();
  for (const t of p.tracks) for (const c of t.clips) if (c.type === 'media') used.add(c.mediaId);
  return used;
}

/**
 * Mídias da biblioteca (`libraryIds`) que nenhum clipe usa. A ordem original da biblioteca é mantida.
 * Serve para limpar o projeto de arquivos importados e esquecidos.
 */
export function unusedMediaIds(p: Project, libraryIds: Iterable<string>): string[] {
  const used = usedMediaIds(p);
  return [...libraryIds].filter((id) => !used.has(id));
}
