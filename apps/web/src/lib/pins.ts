const KEY = 'editor.pinnedProjects';
export const MAX_PINS = 12;

/** Ids fixados guardados no navegador. Dados inválidos ou armazenamento indisponível resultam em lista vazia. */
export function loadPins(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}

export function savePins(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_PINS)));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Fixa (o mais recente vai para a frente; passando do limite, o mais antigo sai) ou desafixa o projeto. */
export function togglePin(pins: string[], id: string): string[] {
  return pins.includes(id) ? pins.filter((p) => p !== id) : [id, ...pins].slice(0, MAX_PINS);
}

/** Coloca os projetos fixados no começo, na ordem em que foram fixados; os demais mantêm a ordem que já tinham. */
export function pinnedFirst<T extends { id: string }>(list: T[], pins: string[]): T[] {
  const rank = new Map(pins.map((id, i) => [id, i]));
  const pinned = list.filter((p) => rank.has(p.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...pinned, ...list.filter((p) => !rank.has(p.id))];
}
