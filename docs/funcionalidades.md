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
| Tira de quadros (miniaturas) nos clipes de vídeo | ✅ | render `filmstrip.test`, API `media.test`, E2E `novidades` |
| Saltar entre cortes (↑/↓) por bordas de clipes e marcadores | ✅ | core `navigation.test`, E2E `novidades` |
| Aparar até a cabeça (Q/W), empurrar seleção (Alt+setas), selecionar à direita/esquerda | ✅ | core `navigation.test`, E2E `novidades` |
| Fechar espaços vazios de uma faixa | ✅ | core `ops/advanced.test`, E2E `novidades` |
| Salvar o quadro atual como PNG | ✅ | E2E `novidades` (assinatura PNG verificada) |
| Modelos de projeto (vertical curto etc.), busca, renomear, duplicar e capa dos projetos | ✅ | web `templates.test`, API `projects.test`, E2E `novidades` |

## Plataforma

| Recurso | Estado | Verificação |
|---|---|---|
| Cadastro/login (scrypt + JWT), isolamento entre usuários | ✅ | API `auth/projects/media/exports` |
| Projeto versionado, migração de versões, controle de concorrência (409), histórico de versões | ✅ | core `migrate`, API `projects.test`, E2E conflito |
| Autosave, rascunho local, modo offline, recuperação | ✅ | E2E `features` |
| Upload resumível em Web Worker, miniaturas/waveform/proxy assíncronos | ✅ | API `media.test`, E2E |
| WebSocket autenticado com progresso | ✅ | API `ws.test`, E2E |
| Rate limit, CORS, cabeçalhos de segurança, validação (Zod) | ✅ | API `auth.test` |
| Armazenamento S3/MinIO | ⬜ | a interface `ObjectStore` existe; só há implementação em disco |
| Fila distribuída (Redis/BullMQ) | ⬜ | a fila é persistida no PostgreSQL e roda no processo da API |
| Edição colaborativa em tempo real | ⬜ | fora do escopo; há detecção de conflito entre sessões |
