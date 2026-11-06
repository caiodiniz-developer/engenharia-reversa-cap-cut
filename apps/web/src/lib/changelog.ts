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
    date: '2026-11-06',
    title: 'Edição profissional e visual de vidro',
    items: [
      { text: 'J-cut e L-cut: o áudio entra antes ou continua depois da imagem, sem desligar o par.', command: 'jcut-1' },
      { text: 'Segurar o último quadro do clipe por alguns segundos.', command: 'hold-last-2' },
      { text: 'Abertura e encerramento suaves do projeto inteiro, com um comando.', command: 'project-fade-out-1' },
      { text: 'Dividir um texto de várias linhas em um texto por linha.', command: 'split-text-lines' },
      { text: 'Converter textos em legendas (e legendas em textos), mantendo o tempo.', command: 'text-to-captions' },
      { text: 'Marcar o início de cada legenda para navegar pelas falas.', command: 'markers-captions' },
      { text: 'Mover a seleção para a faixa de cima ou de baixo e remover as faixas vazias.', command: 'send-track-up' },
      { text: 'Igualar a duração dos clipes selecionados (mais curto, mais longo ou média).', command: 'match-duration-shortest' },
      { text: 'Escalonar a entrada de vários clipes, um depois do outro.', command: 'stagger-0.5' },
      { text: 'Selecionar os clipes que estão dentro do trecho marcado com I e O.', command: 'select-in-range' },
      { text: 'Botões e painéis em vidro, com tema claro e escuro, e a opção de seguir o pedido do sistema por menos transparência ou de usar superfícies sólidas.', command: 'glass-solid' },
      { text: 'Tooltips de vidro com o nome, a descrição e o atalho em tecla, inclusive em botões desabilitados.' },
      { text: 'Paleta com comandos favoritos (estrela) e filtro por grupo: digite @projeto, @texto e assim por diante.' },
      { text: 'Cor de destaque à escolha: verde-água, azul, violeta, laranja ou rosa (todas conferidas no contraste).', command: 'accent-violet' },
    ],
  },
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
