# Editor de vídeo web com IA

Editor de vídeo profissional que roda no navegador (React + TypeScript + Node.js), inspirado na variedade de recursos de editores como o CapCut Pro. É um **produto independente**: analisa apenas comportamento observável e documentação pública, não usa código proprietário e não desbloqueia recursos de terceiros.

- **Timeline multipista** com cortes, trim, snap, keyframes, transições, undo/redo e histórico de operações.
- **Preview** em Canvas + Web Audio e **exportação real** no servidor (FFmpeg) com fila, progresso em tempo real, cancelamento e download assinado.
- **Texto e legendas** (SRT/VTT, destaque da palavra falada), **áudio** (volume, fades, EQ, balanço, normalização, redução de ruído), **efeitos**, **LUTs 3D**, **estabilização**, **máscaras**, chroma key.
- **IA**: transcrição (Whisper local ou API), detecção de silêncio/cenas, sugestão de cortes e melhores trechos, assistente por linguagem natural. Nada é simulado: sem provedor configurado a API responde 503.

> Veja [docs/funcionalidades.md](docs/funcionalidades.md) para o que está pronto, parcial ou ausente, e [docs/limitacoes.md](docs/limitacoes.md) para as limitações conhecidas.

## Início rápido (desenvolvimento)

Requisitos: Node 22+ e pnpm 10. Não é preciso instalar FFmpeg, PostgreSQL nem Docker: o projeto usa `ffmpeg-static` e um PostgreSQL embarcado.

```bash
pnpm install
pnpm dev:api     # PostgreSQL embarcado + schema + API em http://localhost:3001
pnpm dev:web     # editor em http://localhost:5173 (proxy para a API)
```

Abra http://localhost:5173, crie uma conta e um projeto, importe vídeos e edite.

Configuração opcional em `apps/api/.env` (veja [apps/api/.env.example](apps/api/.env.example)): chaves de IA, limites, diretórios de dados. Em máquinas com pouco espaço no disco do sistema, aponte `PGDATA_DIR`, `STORAGE_DIR` e `TEMP_DIR` para outro disco.

### Comandos

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | TypeScript estrito em todos os pacotes |
| `pnpm test` | Vitest: core, render (FFmpeg real), API (PostgreSQL real), web |
| `pnpm e2e` | Playwright com Chrome, API, Vite e PostgreSQL reais |
| `pnpm e2e:prod` | O mesmo Chrome contra o **build de produção** sob a CSP |
| `pnpm build` | Build de produção |

## Arquitetura

```
apps/web         React + Vite + Tailwind + Zustand (timeline, preview, painéis)
apps/api         Express + Prisma + PostgreSQL + WebSocket + fila de tarefas
packages/core    Schema versionado do projeto, operações de timeline, histórico,
                 keyframes, efeitos, LUTs, legendas — puro, usado por web e servidor
packages/render  Timeline → grafo de filtros FFmpeg, execução, análises de mídia
```

O documento do projeto (faixas, clipes, efeitos, keyframes…) é um JSON versionado definido em `packages/core`. O **mesmo código** de transformação, ordem de efeitos, desenho de texto e matemática de LUT roda no preview e na exportação; os testes comparam o arquivo exportado com o preview pixel a pixel. Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## Produção

`docker compose up --build` sobe PostgreSQL, API e nginx (`JWT_SECRET` obrigatório). Detalhes, variáveis, retenção e escala em [docs/operacao.md](docs/operacao.md). Modelo de ameaças e controles em [docs/seguranca.md](docs/seguranca.md).

## Estado da verificação

Cobertura medida nesta base (execução local, Windows 11, Chrome estável):

| Suíte | Testes | O que exercita |
|---|---:|---|
| `packages/core` | 62 | operações de timeline, histórico, keyframes, legendas, efeitos, LUTs |
| `packages/render` | 45 | exportações reais com FFmpeg, inspeção de pixels, nível de áudio, duração, cancelamento |
| `apps/api` | 62 | PostgreSQL real, autorização, upload resumível, fila, exportação, IA (borda de rede simulada) |
| `apps/web` (unit) | 24 | store do editor, mapeamento de tempo, legendas |
| `apps/web` (E2E) | 41 | fluxo completo no Chrome: importar, editar, salvar, exportar, baixar e comparar |
| `apps/web` (E2E de produção) | 3 | build minificado servido com a CSP e os cabeçalhos do nginx: zero violações de CSP e zero erros de console |

**Não verificado neste ambiente:** build das imagens Docker e o `docker compose` (Docker não estava instalado), o workflow de CI do GitHub, transcrição com `whisper.cpp` real, chamadas reais às APIs da OpenAI/Anthropic (testadas apenas contra um servidor local que imita o contrato), Firefox/Safari e dispositivos móveis.
