/** Lista de atalhos do editor (puro: sem store nem DOM). A tela de ajuda, a landing e os testes leem daqui. */
export interface Shortcut {
  keys: string;
  label: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Espaço', label: 'Reproduzir / pausar' },
  { keys: 'S', label: 'Dividir clipe na cabeça de reprodução' },
  { keys: 'Delete', label: 'Excluir seleção' },
  { keys: 'Shift + Delete', label: 'Excluir e fechar o espaço' },
  { keys: 'Ctrl + Z', label: 'Desfazer' },
  { keys: 'Ctrl + Shift + Z  /  Ctrl + Y', label: 'Refazer' },
  { keys: 'Ctrl + C  /  Ctrl + V', label: 'Copiar / colar no cursor' },
  { keys: 'Ctrl + D', label: 'Duplicar' },
  { keys: 'Ctrl + Alt + C  /  Ctrl + Alt + V', label: 'Copiar / colar atributos (posição, efeitos, keyframes)' },
  { keys: 'Ctrl + A', label: 'Selecionar todos os clipes' },
  { keys: 'Ctrl + G  /  Ctrl + Shift + G', label: 'Agrupar / desagrupar' },
  { keys: 'Ctrl + S', label: 'Salvar agora' },
  { keys: 'Ctrl + K', label: 'Abrir a paleta de comandos' },
  { keys: '← / →', label: 'Quadro anterior / próximo' },
  { keys: 'Shift + ← / →', label: 'Voltar / avançar 1 segundo' },
  { keys: '[ / ]', label: 'Reduzir / aumentar a velocidade do preview' },
  { keys: 'I / O', label: 'Marcar entrada / saída do trecho a exportar (Alt + X limpa)' },
  { keys: 'Q / W', label: 'Aparar início / fim do clipe até a cabeça de reprodução' },
  { keys: 'Alt + ← / →', label: 'Empurrar a seleção 1 quadro (com Shift, 1 segundo)' },
  { keys: '↑ / ↓', label: 'Corte anterior / seguinte (bordas de clipes e marcadores)' },
  { keys: 'Home / End', label: 'Ir ao início / ao fim' },
  { keys: 'M', label: 'Adicionar marcador' },
  { keys: 'N', label: 'Ligar/desligar ímã (snap)' },
  { keys: '+ / −', label: 'Aumentar / diminuir zoom da timeline' },
  { keys: 'Shift + Z', label: 'Ajustar o projeto à largura da timeline' },
  { keys: 'F', label: 'Modo foco (esconde painéis; só preview e timeline)' },
  { keys: 'Shift + F', label: 'Dar zoom na seleção' },
  { keys: 'Shift + R', label: 'Girar o clipe 90° para a direita' },
  { keys: 'Alt + I', label: 'Inverter a seleção (seleciona o que não estava selecionado)' },
  { keys: 'Alt + B', label: 'Boomerang: o clipe selecionado toca e volta em reverso' },
  { keys: 'Alt + R', label: 'Abrir a rampa de velocidade do clipe selecionado' },
  { keys: 'Ctrl + roda do mouse', label: 'Zoom na timeline' },
  { keys: 'Alt ao arrastar', label: 'Ignora o ímã / seleciona só o clipe (sem vinculados)' },
  { keys: 'Esc', label: 'Limpar seleção' },
  { keys: '?', label: 'Mostrar atalhos' },
];
