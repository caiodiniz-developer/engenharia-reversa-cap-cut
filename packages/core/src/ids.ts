/** Gera um id único; funciona no navegador e no Node. */
export function newId(prefix = ''): string {
  const uuid = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${uuid}` : uuid;
}
