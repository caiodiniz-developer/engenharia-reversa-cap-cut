# Regras do projeto

## Git
- Todo trabalho é commitado direto na `main` (sem branches).
- Commits pequenos e granulares: um commit por mudança lógica.
- Meta: no mínimo 100 commits por sessão de trabalho. Nunca criar commits vazios ou sem sentido para bater a meta.

## Princípios de produto
- Aplicação 100% web (sem Electron/Tauri). Projeto independente: nada de código proprietário nem de desbloqueio de recursos de terceiros.
- Não simular funcionalidades: sem provedor de IA configurado a API responde 503 com instrução clara.
- Preview e exportação partem das mesmas definições (`packages/core`). Ao criar/alterar um efeito, a versão em pixels (`pixel`) e a do FFmpeg (`ffmpeg`) devem ser alteradas juntas, com teste de paridade.
- Documentar limitações em `docs/limitacoes.md` e manter `docs/funcionalidades.md` fiel ao que os testes provam. Não inventar resultados de teste.

## Estrutura
- `packages/core` (puro, sem DOM/Node), `packages/render` (FFmpeg), `apps/api` (Express/Prisma), `apps/web` (React/Vite). Veja `docs/arquitetura.md`.

## Comandos
- `pnpm dev:api` + `pnpm dev:web` — desenvolvimento (PostgreSQL embarcado, FFmpeg empacotado).
- `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm e2e:prod`, `pnpm build`.
- Rode typecheck + testes do pacote afetado antes de commitar mudanças relevantes; E2E ao mexer em fluxos de interface/exportação.

## Convenções
- TypeScript estrito. Dependência nova só com justificativa (versão exata fixada).
- Textos da interface e mensagens de erro em português do Brasil.
- Operações de timeline são funções imutáveis em `packages/core/src/ops`; a interface chama `useEditor.run(...)`, que trata `TimelineError`.
- Mudou o schema do projeto? Suba `SCHEMA_VERSION` e registre a migração em `packages/core/src/migrate.ts`. Mudou o Prisma? Gere uma migração em `apps/api/prisma/migrations`.
- Nunca exponha chaves no frontend nem aceite comandos/argumentos do navegador para o FFmpeg.
- Ação nova de edição: operação pura em `packages/core/src/ops` (com teste), ação no store, comando em `apps/web/src/editor/commands.ts` (paleta Ctrl+K) e, se houver tecla, linha em `SHORTCUTS` de `useShortcuts.ts`.
- Nos E2E, depois de executar um comando da paleta ou fechar um diálogo, espere o combobox/diálogo ficar oculto antes de usar atalhos de teclado (o atalho é ignorado enquanto o diálogo existe no DOM).

## Ambiente Windows com pouco disco
- Se o disco do sistema estiver cheio, use um `.npmrc` local (ignorado pelo git) com `store-dir` e `virtual-store-dir` em outro disco e defina `TEMP`/`TMP`, `PGDATA_DIR`, `STORAGE_DIR`, `TEMP_DIR`, `PLAYWRIGHT_BROWSERS_PATH` apontando para ele.
- Os E2E usam o Google Chrome instalado (`channel: 'chrome'`) porque o Chromium do Playwright não decodifica H.264.
