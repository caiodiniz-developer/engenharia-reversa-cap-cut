/** Baixa um texto como arquivo. `bom` ajuda o Excel a reconhecer UTF-8 em CSV. */
export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8', bom = false): void {
  const url = URL.createObjectURL(new Blob([bom ? '\uFEFF' + text : text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Nome de arquivo seguro a partir do nome do projeto. */
export function fileBase(name: string, fallback = 'projeto'): string {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || fallback;
}
