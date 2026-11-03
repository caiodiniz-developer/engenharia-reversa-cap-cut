export interface NewsItem {
  text: string;
  /** Id de um comando da paleta que dá para experimentar na hora. */
  command?: string;
}

export interface NewsEntry {
  /** AAAA-MM-DD. */
  date: string;
  title: string;
  items: NewsItem[];
}

/** Do mais recente para o mais antigo. Todo item com command é conferido por teste contra a paleta de verdade. */
export const NEWS: NewsEntry[] = [
  {
    date: '2026-11-03',
    title: 'Ferramentas criativas',
    items: [
      { text: 'Rampa de velocidade personalizada: escolha de quanto a quanto o clipe acelera e veja a duração final antes de aplicar.', command: 'ramp-custom' },
      { text: 'Boomerang: o clipe toca e volta em reverso.', command: 'boomerang' },
      { text: 'Gagueira: repete um trecho curtinho várias vezes, no ritmo da batida.', command: 'stutter-0.25' },
      { text: 'Tela dividida: dois clipes lado a lado ou um sobre o outro, já cortados para caber.', command: 'split-side' },
      { text: 'Imagem dentro da imagem num canto do quadro.', command: 'pip-br' },
      { text: 'Carimbar o clipe em cada marcador (bom para efeitos sonoros).', command: 'stamp-markers' },
      { text: 'Transição em todos os cortes da faixa de uma vez.', command: 'transitions-all-fade' },
      { text: 'Selecionar por critério: com efeitos, silenciados, mais curtos que 1 s e outros.', command: 'select-where-effects' },
      { text: 'Quebrar legendas longas respeitando o tempo de cada palavra.', command: 'captions-split-long' },
    ],
  },
  {
    date: '2026-11-01',
    title: 'Ferramentas em lote',
    items: [
      { text: 'Legendas a partir de um roteiro colado, com o tempo repartido pelo tamanho de cada fala.', command: 'script-captions' },
      { text: 'Estatísticas do projeto: duração, clipes por tipo, palavras e mídia usada.', command: 'project-stats' },
      { text: 'Substituir uma mídia por outra em todos os clipes, mantendo posição e ajustes.', command: 'replace-media' },
      { text: 'Abaixar a música automaticamente quando outros clipes falam (ducking).', command: 'duck' },
      { text: 'Ken Burns: zoom lento em fotos e vídeos.', command: 'ken-in' },
      { text: 'Marca d’água de texto num canto do quadro.', command: 'watermark-br' },
    ],
  },
];
