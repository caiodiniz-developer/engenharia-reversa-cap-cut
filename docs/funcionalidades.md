# Matriz de funcionalidades

Legenda: ✅ implementado e verificado por teste automatizado · 🟨 parcial (veja a nota) · ⬜ não implementado

Cada ✅ aponta o teste que o exercita. "E2E" = Playwright no Chrome com API, Vite e PostgreSQL reais; "render" = exportação real com FFmpeg e inspeção do arquivo.

## Timeline e edição

| Recurso | Estado | Verificação |
|---|---|---|
| Faixas de vídeo, áudio, texto e legendas | ✅ | core `ops`, E2E `editor` |
| Inserir, mover, dividir, aparar, duplicar, copiar/colar, excluir (com/sem fechar espaço) | ✅ | core `clips.test`, store, E2E `editor` |
| Snap magnético, seleção múltipla (Shift/marquee), agrupar, desvincular áudio/vídeo | ✅ | core `snap`, E2E `editor`/`features` |
| Bloquear, ocultar e silenciar faixas | ✅ | E2E `features` |
| Zoom (Ctrl+roda), navegação por quadros, marcadores, régua | ✅ | E2E `editor` |
| Undo/redo, arrasto fundido em um passo, histórico navegável | ✅ | core `history`, store, E2E `editor` |
| Velocidade (0,1×–8×), reverso, congelar quadro | ✅ | core, render `render.test`/`render2.test` |
| Transições entre clipes (dissolver, deslizar ×4, cortina ×2) com sobreposição real | ✅ | core `advanced`, render, E2E `features` |
| Keyframes (posição, escala, rotação, opacidade, volume) com easing | ✅ | core, render `tf4/tf5`, E2E `features` |
| Transformações, recorte, espelhar, máscara retângulo/elipse | ✅ | render `render2.test` |
| Remover trechos (pausas) fechando vãos | ✅ | core `removeRanges`, E2E `features` |
| Detecção de cenas e silêncios, sugestão de cortes e de melhores trechos | ✅ | API `ai.test`, E2E `features` |
| Estabilização de imagem (vidstab, 2 passadas) | ✅ | render `render3` (instabilidade 9,98 → 3,80), E2E `advanced` |
| Presets de edição (looks e modelos de texto) | ✅ | store |
| Preview em reverso | 🟨 | avança por quadros e sem som; a exportação toca normalmente |

## Texto e legendas

| Recurso | Estado | Verificação |
|---|---|---|
| Títulos com fonte, cor, contorno, sombra, degradê, fundo, alinhamento | ✅ | render `render2` (texto), E2E `features` |
| Animações de entrada/saída (aparecer, subir/descer, pop) | ✅ | render `render2` |
| Biblioteca de animações prontas (entrada, saída, movimento) que viram keyframes editáveis | ✅ | core `animation.test`, E2E `novidades` |
| Legendas editáveis, tempos por palavra, destaque da palavra falada | ✅ | render `render2`, E2E `features` |
| Importar/exportar SRT e VTT | ✅ | core `captions`, E2E `features` |
| Geração automática por IA | 🟨 | funciona com `WHISPER_BIN`/`OPENAI_API_KEY`; testada contra servidor local que imita a API, não contra o serviço real |
| Modelos de texto reutilizáveis | ✅ | guardados no IndexedDB do navegador (não sincronizam entre dispositivos) |

## Áudio

| Recurso | Estado | Verificação |
|---|---|---|
| Importar áudio, extrair de vídeo, forma de onda | ✅ | API `media.test`, E2E `features` |
| Volume (com keyframes), fade in/out | ✅ | render `render2`/`render4` (nível medido no arquivo) |
| Crossfade automático em transições | ✅ | render `render4` (o nível na sobreposição não dobra) |
| Equalizador de 3 bandas, balanço, mixagem multipista | ✅ | render `render4` (graves ±12 dB, pan, soma de faixas medidos) |
| Exportar só o áudio (MP3, M4A, WAV), com intervalo | ✅ | render `audioassets.test`, API `exports.test`, E2E `export` |
| Tamanho estimado da exportação só de áudio (WAV exato, MP3 ±15%, M4A como teto) | ✅ | web `audioSize.test`, render `audiosize.test` (arquivos reais) |
| Marcar trecho (I/O) na régua e exportar só ele | ✅ | core `navigation.test`, API `exports.test` (range), E2E `export` |
| Exportar em GIF animado (até 30 s e 720p) | ✅ | render `gif.test`, API `exports.test`, E2E `export` |
| Predefinições de exportação (YouTube, redes sociais, WhatsApp, 4K, WebM, GIF, MP3) | ✅ | web `exportPresets.test`, E2E `export` |
| Normalização (−16 LUFS, 2 passadas) | 🟨 | verificada na exportação (`render4`); **não** aplicada no preview |
| Redução de ruído (afftdn) | 🟨 | exportação não quebra e preserva o sinal; eficácia sobre ruído real não medida; **não** aplicada no preview |
| Detecção de silêncio e de batidas | ✅ | API `ai.test`, core `analysis` |
| Gravação de voz pelo microfone (entra na faixa de áudio) | ✅ | E2E `novidades` (microfone falso do Chrome), render `probe.test` (WebM sem duração no cabeçalho) |
| Separação de voz e música | ⬜ | exige modelo de ML; não integrado |

## Efeitos

| Recurso | Estado | Verificação |
|---|---|---|
| Brilho, contraste, exposição, saturação, temperatura | ✅ | render: preview = arquivo (tolerância 14/255) |
| Desfoque, nitidez, vinheta, granulação, glitch, aberração cromática | ✅ | render `render2` |
| Chroma key | ✅ | render `chroma` |
| LUTs 3D `.cube` (embutidas geradas + importação) | ✅ | render `render3` (paridade preview × arquivo), E2E `advanced` |
| Presets reutilizáveis | ✅ | core `effects` |

## IA

| Recurso | Estado | Verificação |
|---|---|---|
| Transcrição | 🟨 | ver acima; sem provedor responde 503 |
| Assistente por linguagem natural (proposta validada pelas operações da timeline, revisável) | 🟨 | testado com servidor que imita a API do provedor |
| Resumo e sugestão de títulos | 🟨 | idem |
| Orçamento diário de chamadas e consentimento explícito para envio a terceiros | ✅ | API `ai.test`, UI |
| Remoção de fundo, isolamento vocal | ⬜ | não implementados (a UI informa) |

## Exportação

| Recurso | Estado | Verificação |
|---|---|---|
| Renderização no servidor com FFmpeg (H.264, H.265, VP9) | ✅ | render, API `exports.test`, E2E `export` |
| Resolução, FPS, qualidade; intervalo da timeline | ✅ | render, API |
| Fila com concorrência por tipo, progresso real, cancelamento, retentativas, timeout | ✅ | API `queue.test`, `exports.test` |
| Link assinado de download, retenção e limpeza | ✅ | API `exports.test` |
| Rascunho local no navegador (MediaRecorder → WebM) | ✅ | E2E `advanced` — tempo real, qualidade do preview |
| Renderização local com ffmpeg.wasm / WebCodecs | ⬜ | não implementada; a exportação final é sempre no servidor |

## Interface e produtividade

| Recurso | Estado | Verificação |
|---|---|---|
| Paleta de comandos (Ctrl+K) com busca sem acento | ✅ | web `commands.test`, E2E `novidades` |
| Tema claro/escuro persistido, inclusive na tela de projetos | ✅ | E2E `novidades` |
| Painel lateral recolhível, trilho de ferramentas com rótulos | ✅ | E2E `novidades` |
| Propriedades em abas conforme o tipo do clipe | ✅ | E2E `novidades` |
| Fundos de cor sólida e degradês gerados no servidor (viram mídia) | ✅ | API `generated.test`, render `generated.test`, E2E `novidades` |
| Formas (círculo, quadrado, arredondado, triângulo, estrela, coração, seta, linha) com transparência | ✅ | render `generated.test`+`shapes.test` (transparência na exportação), API `generated.test`, E2E `novidades` |
| Tira de quadros (miniaturas) nos clipes de vídeo | ✅ | render `filmstrip.test`, API `media.test`, E2E `novidades` |
| Saltar entre cortes (↑/↓) por bordas de clipes e marcadores | ✅ | core `navigation.test`, E2E `novidades` |
| Aparar até a cabeça (Q/W), empurrar seleção (Alt+setas), selecionar à direita/esquerda | ✅ | core `navigation.test`, E2E `novidades` |
| Lista de marcadores (ir, renomear, trocar a cor, remover) | ✅ | E2E `novidades` |
| Mover faixa para cima/baixo; estado vazio do preview com atalhos (importar, fundos e formas, texto) | ✅ | E2E `novidades` |
| Velocidade do preview (0,25× a 2×; não afeta a exportação) | ✅ | E2E `novidades` (movimento da cabeça medido; o som em velocidades diferentes de 1× não foi avaliado) |
| Copiar/colar atributos (Ctrl+Alt+C/V), redefinir transformação, colocar em sequência, dividir nos marcadores | ✅ | core `ops/arrange.test`, E2E `novidades` |
| Ir para um tempo digitado (clique no timecode ou pela paleta; 1:30, 00:00:01:15, 2m30s) | ✅ | core `time.test`, E2E `novidades` |
| Selecionar todos os vídeos, imagens, áudios, textos ou legendas (paleta) | ✅ | core `navigation.test`, E2E `novidades` |
| Barra de estado e altura das faixas (compacta/normal/alta, lembrada no navegador) | ✅ | web `geometry.test`, E2E `novidades` |
| Ordenar a biblioteca (nome, duração, tamanho, não usadas primeiro) | ✅ | web `mediaSort.test`, E2E `novidades` |
| Repetir um clipe N vezes (2×, 3×, 5×) | ✅ | core `ops/repeat.test`, E2E `mais` |
| Texto: MAIÚSCULAS, minúsculas, Cada Palavra Maiúscula, frase | ✅ | core `ops/textedit.test`, E2E `mais` |
| Localizar e substituir em textos e legendas (literal, com opção de maiúsculas e só na seleção) | ✅ | core `ops/textedit.test`, E2E `mais` |
| Duplicar faixa com clipes (ids, ligações e grupos novos) | ✅ | core `ops/trackdup.test`, E2E `mais` |
| Posicionar na grade 3×3, preencher o quadro (cover) e girar 90° (Shift+R) | ✅ | core `layout.test`, E2E `mais` |
| Estender o clipe até a cabeça de reprodução | ✅ | E2E `mais` |
| Bloquear/ocultar/silenciar todas as faixas de uma vez | ✅ | E2E `mais` |
| Zoom na seleção (Shift+F) | ✅ | E2E `mais` |
| Volume ±10%, mudo, fades de 0,5/1/2 s e velocidade 0,5×–2× por comando | ✅ | E2E `mais` |
| Copiar capítulos dos marcadores no formato do YouTube | ✅ | core `chapters.test`, E2E `mais` |
| Renomear mídia na biblioteca (nome de exibição; arquivo intacto) | ✅ | API `media.test`, E2E `mais` |
| Modo foco (F) e propriedades recolhíveis (lembrado no navegador) | ✅ | E2E `mais` |
| Comandos recentes primeiro na paleta | ✅ | web `recentCommands.test`, E2E `mais` |
| Clipes na timeline com tooltip detalhado, selos de volume/mudo e rampas de fade | ✅ | web `clipInfo.test`, E2E `mais` |
| Menu de contexto do clipe (botão direito) com as ações mais usadas | ✅ | web `ClipContextMenu.test`, E2E `mais` |
| Atalhos agrupados por categoria com busca sem acento | ✅ | web `shortcutGroups.test`, E2E `mais` |
| Legendas: juntar em uma, atrasar/adiantar 0,5 s e achar as rápidas demais (> 20 caracteres/s) | ✅ | core `ops/captions.test`, E2E `mais` |
| Limpar mídias não usadas (lista, remove arquivos e mantém as em uso) | ✅ | core `usage.test`, E2E `mais` |
| Duração fixa (1, 2, 3, 5 ou 10 s) para vários clipes de uma vez | ✅ | core `ops/duration.test`, E2E `mais` |
| **Revisão do projeto**: 15 verificações com “ir até” e correção (espaços vazios, início sem imagem, clipes curtos, legendas rápidas/sobrepostas, sem legendas, mídia ampliada, volume alto, contraste, zona segura, mídias não usadas, faixas vazias/ocultas, duração e formato da plataforma) e nota 0–100 | ✅ | core `review.test`, E2E `diferenciais` |
| Nota de acessibilidade (legendas, contraste, zona segura) separada da nota de qualidade | ✅ | core `review.test`, E2E `diferenciais` |
| Plataformas de destino (Shorts, Reels, TikTok, Stories, feed 1:1 e 4:5, YouTube): formato, duração recomendada e zonas cobertas pela interface desenhadas no preview | 🟨 | core `platforms.test`, E2E `diferenciais` — os valores são aproximações, não regras oficiais |
| Ritmo da edição: planos, duração média/mediana, cortes por minuto, histograma, mapa de cortes e trechos parados | ✅ | core `pacing.test`, E2E `diferenciais` |
| Montagem no ritmo: refaz a faixa com um plano por intervalo entre marcadores | ✅ | core `ops/montage.test`, E2E `diferenciais` |
| Encaixar clipes numa duração-alvo (muda a velocidade de 0,5× a 2×) | ✅ | core `ops/fit.test`, E2E `diferenciais` |
| Roteiro visual: planos de uma faixa em ordem, trocar de lugar mantendo vãos e partes ligadas | ✅ | core `ops/reorder.test`, E2E `diferenciais` |
| Tarefas de edição ancoradas no tempo (marcadores ☐/☑ na régua) | ✅ | core `todo.test`, E2E `diferenciais` |
| Exportar EDL (CMX 3600), planilha CSV da timeline, roteiro com tempos e descrição pronta (título, capítulos, mídias) | 🟨 | core `interchange.test`, E2E `diferenciais` — o EDL não foi aberto em programas de terceiros |
| Comparar uma versão salva com o projeto atual (o que mudou) | ✅ | core `diff.test`, API `projects.test`, E2E `diferenciais` |
| Replay do histórico de edições (passo a passo, sem salvar nada) | ✅ | E2E `diferenciais` |
| Simulador de daltonismo no preview (protanopia, deuteranopia, tritanopia, acromatopsia) | 🟨 | web `vision.test`, E2E `diferenciais` — aproximação por matrizes de cor, só no preview |
| Cores do quadro: paleta dominante do preview aplicada ao texto selecionado | ✅ | web `palette.test`, E2E `diferenciais` |
| Fechar espaços vazios de uma faixa | ✅ | core `ops/advanced.test`, E2E `novidades` |
| Salvar o quadro atual como PNG | ✅ | E2E `novidades` (assinatura PNG verificada) |
| Modelos de projeto (vertical curto etc.), busca, renomear, duplicar e capa dos projetos | ✅ | web `templates.test`, API `projects.test`, E2E `novidades` |

## Plataforma

| Recurso | Estado | Verificação |
|---|---|---|
| Cadastro/login (scrypt + JWT), isolamento entre usuários | ✅ | API `auth/projects/media/exports` |
| Projeto versionado, migração de versões, controle de concorrência (409), histórico de versões | ✅ | core `migrate`, API `projects.test`, E2E conflito |
| Diálogo de versões: salvar marco nomeado e restaurar (guarda o estado anterior) | ✅ | API `projects.test`, E2E `novidades` |
| Autosave, rascunho local, modo offline, recuperação | ✅ | E2E `features` |
| Upload resumível em Web Worker, miniaturas/waveform/proxy assíncronos | ✅ | API `media.test`, E2E |
| WebSocket autenticado com progresso | ✅ | API `ws.test`, E2E |
| Rate limit, CORS, cabeçalhos de segurança, validação (Zod) | ✅ | API `auth.test` |
| Armazenamento S3/MinIO | ⬜ | a interface `ObjectStore` existe; só há implementação em disco |
| Fila distribuída (Redis/BullMQ) | ⬜ | a fila é persistida no PostgreSQL e roda no processo da API |
| Edição colaborativa em tempo real | ⬜ | fora do escopo; há detecção de conflito entre sessões |
