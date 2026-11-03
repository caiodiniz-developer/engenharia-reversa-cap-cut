export type MediaView = 'grid' | 'list';
const KEY = 'editor.mediaView';

export function loadMediaView(): MediaView {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function saveMediaView(v: MediaView): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Classes de cada parte do item da biblioteca em cada modo (a grade mostra miniaturas grandes; a lista, linhas compactas). */
export function mediaViewClasses(v: MediaView): { list: string; card: string; thumb: string; text: string } {
  return v === 'list'
    ? { list: 'flex flex-col gap-1.5', card: 'flex items-center', thumb: 'h-12 w-20 shrink-0', text: 'min-w-0 flex-1 px-2.5 py-1' }
    : { list: 'grid grid-cols-2 gap-2', card: '', thumb: 'aspect-video', text: 'px-1.5 py-1' };
}
