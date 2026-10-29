# Arquitetura

## Visão geral

```
Navegador (React)                      Servidor Node.js                        Infra
┌────────────────────────┐   HTTP/WS   ┌─────────────────────────────┐      ┌────────────┐
│ UI + store (Zustand)   │────────────▶│ Express: auth, projetos,    │─────▶│ PostgreSQL │
│ timeline / propriedades│             │ mídia, exportação, IA       │      └────────────┘
│ Preview: Canvas + Web  │◀────────────│ Fila de tarefas (no banco)  │      ┌────────────┐
│ Audio, Web Worker de   │  WebSocket  │ FFmpeg / ffprobe (spawn)    │─────▶│ Disco /    │
│ upload, IndexedDB      │  (eventos)  │ Canvas (texto), IA          │      │ objetos    │
└────────────────────────┘             └─────────────────────────────┘      └────────────┘
```

Três camadas, como pedido: **frontend** (interface, timeline, preview, atalhos), **backend** (autenticação, validação, filas, FFmpeg, IA) e **armazenamento** (PostgreSQL para metadados e documentos; disco para mídias; IndexedDB só para cache e rascunhos locais).

## Pacotes

| Pacote | Responsabilidade | Depende de |
|---|---|---|
| `packages/core` | Schema versionado do projeto (Zod), operações **imutáveis** de timeline, undo/redo, keyframes, registro de efeitos, LUTs, SRT/VTT, desenho de texto, análise de áudio | zod |
| `packages/render` | Timeline → filtergraph do FFmpeg, execução com progresso/cancelamento, ffprobe, waveform/proxy/miniatura, análises (silêncio, cenas) | core, ffmpeg-static, @napi-rs/canvas |
| `apps/api` | HTTP, WebSocket, Prisma, fila, armazenamento, IA | core, render |
| `apps/web` | Interface | core |

`core` é puro e roda no navegador e no servidor. Isso é o que garante que **preview e exportação partam das mesmas definições**.

## Modelo do projeto

Um único documento JSON versionado (`version`, `settings`, `media`, `tracks[].clips[]`, `markers`, `luts`). Clipes são uma união discriminada: `media`, `text`, `caption`. Tempo em segundos, arredondado a 6 casas para não acumular erro de ponto flutuante; a duração mínima de um clipe é 1 quadro do projeto.

- **Invariantes** (verificadas em cada operação): sem sobreposição na faixa (exceto sobreposição coberta por uma transição de entrada), clipe compatível com o tipo da faixa, faixa desbloqueada, intervalo de origem dentro da duração da mídia.
- **Evolução:** `migrateProject` aplica migrações incrementais por versão; versões futuras são recusadas. A API valida o documento a cada salvamento e confere que toda mídia referenciada pertence ao projeto.
- **Por que JSON e não tabelas por clipe:** a timeline é editada de forma atômica e o histórico precisa de snapshots; relacional ficou para posse, mídia, tarefas e exportações (`User`, `Project`, `ProjectVersion`, `Media`, `Job`, `Export`).

## Preview × exportação

| Aspecto | Preview (navegador) | Exportação (servidor) |
|---|---|---|
| Transformação/keyframes | `resolveTransform` do core | mesma curva convertida em expressões do FFmpeg (`keyframeExpr`) |
| Efeitos | `EFFECTS[].pixel` (RGBA) | `EFFECTS[].ffmpeg` (filtros), na mesma ordem (opacos antes dos com alfa) |
| LUT | `applyLut` trilinear | `lut3d interp=trilinear` com o mesmo `.cube` |
| Texto/legendas | `layoutText`/`drawLayout` em Canvas | os **mesmos** em `@napi-rs/canvas`, gerando PNGs |
| Transições | progresso suavizado `p²(3−2p)` | mesma expressão no `overlay`/`fade`/`geq` |

Os testes de integração comparam o arquivo exportado com o resultado do preview (tolerâncias por canal documentadas nos próprios testes).

### Como a timeline vira FFmpeg

Cada clipe de vídeo vira uma cadeia independente (`-ss/-t` na entrada → trim/velocidade/reverso → recorte → ajuste ao quadro → escala → efeitos opacos → `rgba` → chroma key → máscara → opacidade → rotação → transição), sobreposta sobre o fundo na ordem das faixas. Áudio: uma cadeia por clipe (tempo, EQ, normalização em 2 passadas, pan, volume/keyframes, fades, atraso) e `amix`. O grafo é gravado em arquivo (`-filter_complex_script`) e o FFmpeg é sempre executado com `spawn` e argumentos montados no servidor.

Dois pontos não óbvios que os testes de integração descobriram:
- `overlay` ignora mudança de tamanho no meio do fluxo, então **escala animada** amplia o clipe até a maior escala e encolhe com `perspective` (que repete pixels de borda; um `geq` zera o alfa fora do quadro).
- `perspective` não tem a variável `t`; usa-se `on/fps`.

## Tarefas assíncronas

`JobQueue` persiste cada tarefa (estado, progresso, resultado, tentativas) no PostgreSQL e executa no processo da API com concorrência por faixa (`export`, `processing`, `ai`), timeout, cancelamento por `AbortController` e retentativa controlada (erros marcados como não repetíveis falham de imediato). No início, tarefas que estavam `running` voltam para `queued`. Progresso e término são empurrados ao navegador por WebSocket (primeira mensagem autentica; eventos só para o dono).

## Frontend

- **Estado:** um store Zustand com `History<Project>` (snapshots imutáveis com compartilhamento estrutural). Arrastos contínuos são fundidos num único passo (`coalesceKey`), operações inválidas viram toast (ou falham em silêncio durante o arrasto).
- **Timeline:** DOM + canvas só para a régua (desenha apenas a janela visível). Arrasto com snap, trim, marquee, zoom ancorado no cursor.
- **Preview:** `PlayerEngine` mantém elementos `<video>/<audio>` como escravos do relógio, mixa com Web Audio (ganho, 3 bandas, pan) e compõe em Canvas 2D (`composeFrame`). Usa o proxy H.264 de 360p gerado no servidor.
- **Salvamento:** debounce → `PUT` com `baseRevision` (409 em conflito) → rascunho paralelo no IndexedDB → recuperação ao reabrir; offline tenta de novo ao voltar.
- **Rotas:** `/` mostra a landing (`pages/landing`) para visitantes e a lista de projetos para quem tem sessão; `/login` (aceita `?modo=cadastro`) e `/p/:id` (protegida). Os números da landing são lidos do `packages/core`, então acompanham o produto.
- **Shell do editor:** trilho de ferramentas (`ToolRail`) + painel lateral recolhível + preview + propriedades em abas + timeline. O catálogo de comandos (`editor/commands.ts`) alimenta a paleta (Ctrl+K) e é a fonte única das ações pesquisáveis. O tema vive em `store/theme.ts` (variáveis CSS RGB trocadas por `data-theme`).
- **Animações:** `packages/core/src/animation.ts` define presets que geram keyframes comuns; a aplicação passa por `useEditor.run`, então desfazer/refazer funcionam sem código especial.
- **Mídia gerada:** `POST /projects/:id/generated` cria PNGs de fundo com o FFmpeg (`packages/render/src/generated.ts`) e os registra como mídia comum. A tira de quadros (`Media.film`, migração `0002_project_meta_media_film`) é gerada junto com as demais derivadas.
- **Projetos:** `Project.meta` guarda um resumo (duração, contagem de clipes) para a listagem; a capa é a miniatura da primeira mídia. Duplicar copia o documento e os arquivos de mídia numa transação.
- **Web Worker:** upload resumível em partes de 8 MB, fora da thread principal.

## Decisões e desvios do planejamento original

| Planejado | Feito | Por quê |
|---|---|---|
| NestJS | **Express** + Zod | O ganho de injeção de dependência não compensava a fricção de decorators/metadados com `tsx` e Vitest; os módulos são funções simples e testáveis |
| Redis + BullMQ | Fila no PostgreSQL | Menos infraestrutura para operar; mesma interface permite trocar quando houver várias instâncias |
| S3/MinIO | Disco local atrás de `ObjectStore` | Não havia como testar S3 neste ambiente; a interface está pronta |
| WebGL/WebGPU | Canvas 2D | Suficiente para o preview em ≤ 960 px; sem ganho que justificasse shaders duplicados |
| GSAP | Não usado | Nenhuma animação de rolagem/timeline de marketing no produto; Framer Motion cobre modais e painéis |
| ffmpeg.wasm / WebCodecs | Gravação local via MediaRecorder | Memória do navegador e formatos limitam; a exportação final é no servidor |
