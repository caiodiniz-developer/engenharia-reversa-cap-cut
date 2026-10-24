# Operação e implantação

> O fluxo de Docker/Compose abaixo **não foi executado** neste ambiente (Docker não estava instalado). Os componentes que ele empacota — migrações, API, build estático, cabeçalhos do nginx — foram verificados individualmente (ver "O que foi verificado").

## Topologia recomendada

```
Internet ─▶ TLS (CDN / balanceador) ─▶ nginx (estático + proxy /api, /ws) ─▶ API Node ─▶ PostgreSQL
                                                                              └──────▶ volume de mídia
```

- Hospedagem do front: qualquer CDN/estático (o build é `apps/web/dist`), desde que `/api` e `/ws` cheguem à API na **mesma origem** (links assinados e WebSocket assumem isso; do contrário configure `PUBLIC_API_URL` e `CORS_ORIGINS`).
- API e renderização: um contêiner por instância com FFmpeg embutido (`ffmpeg-static`). Cada exportação ocupa CPU por minutos: dimensione `EXPORT_CONCURRENCY` pelo número de núcleos e limite recursos do contêiner.
- Banco: PostgreSQL 16 gerenciado em produção.
- Armazenamento: volume persistente (`/data`). Para várias instâncias da API é preciso storage compartilhado ou implementar `ObjectStore` para S3.

## Subir com Docker Compose

```bash
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
docker compose up --build        # http://localhost:8080
```

O contêiner da API executa `prisma migrate deploy` e depois inicia o servidor. Defina `PUBLIC_ORIGIN` se o endereço público não for `http://localhost:8080`.

## Variáveis de ambiente

Todas estão documentadas, com padrões, em [`apps/api/.env.example`](../apps/api/.env.example). Obrigatória em produção: `JWT_SECRET`. Destaques:

| Variável | Efeito |
|---|---|
| `DATABASE_URL` | Conexão do PostgreSQL |
| `PUBLIC_API_URL`, `CORS_ORIGINS` | Origem pública usada nos links assinados e origens permitidas |
| `TRUST_PROXY` | Nº de proxies à frente da API (1 com nginx) — necessário para o rate limit ver o IP real |
| `EXPORT_CONCURRENCY`, `PROCESSING_CONCURRENCY` | Exportações / processamentos de mídia simultâneos |
| `MAX_UPLOAD_BYTES`, `MAX_MEDIA_SECONDS`, `MAX_PROJECT_MEDIA` | Limites de entrada |
| `EXPORT_RETENTION_HOURS`, `EXPORT_TIMEOUT_SECONDS` | Retenção dos arquivos exportados e teto de render |
| `WHISPER_BIN` + `WHISPER_MODEL` | Transcrição local (`whisper.cpp`) |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_DAILY_CALL_LIMIT` | Provedores externos e orçamento |

## Banco e migrações

- Esquema em `apps/api/prisma/schema.prisma`; migrações versionadas em `apps/api/prisma/migrations`.
- Aplicar: `pnpm --filter @editor/api exec prisma migrate deploy`. Criar nova migração em desenvolvimento: `prisma migrate dev --name <mudança>`.
- O teste `test/migrations.test.ts` aplica as migrações em um PostgreSQL vazio e confirma que não há divergência com o schema.
- Backup: `pg_dump` do banco **e** do volume `/data` (os dois precisam ser consistentes entre si).

## Rotinas

- **Retenção:** de hora em hora a API apaga os arquivos de exportações expiradas. Mídias e projetos só são removidos quando o usuário os exclui.
- **Reinício:** tarefas `running` voltam para a fila; uploads incompletos ficam em `<TEMP_DIR>/editor-api/uploads` (não há limpeza automática de sessões abandonadas — agende `find … -mtime +1 -delete`).
- **Saúde:** `GET /api/health`.

## Escalar

1. Várias instâncias da API exigem (a) storage compartilhado ou S3 e (b) mover o consumo da fila para `SELECT … FOR UPDATE SKIP LOCKED` (ou BullMQ). Hoje cada instância executa as tarefas que ela mesma enfileirou e recupera as pendentes ao iniciar.
2. Separar workers de renderização da API HTTP é o passo natural seguinte: a lógica já está isolada em `registerJobs`.

## Desenvolvimento em máquina com pouco disco (Windows)

O PostgreSQL embarcado, os uploads e os temporários podem ser apontados para outro disco: `PGDATA_DIR`, `STORAGE_DIR`, `TEMP_DIR`. O pnpm pode usar `store-dir` e `virtual-store-dir` em outro disco por meio de um `.npmrc` local (arquivo ignorado pelo git).

## O que foi verificado

| Item | Como |
|---|---|
| Migrações em banco vazio | teste automatizado com PostgreSQL real |
| API, fila, exportação, IA, WebSocket | suíte de 62 testes com PostgreSQL e FFmpeg reais |
| Build estático + CSP + proxy HTTP/WS | E2E de produção no Chrome, com o mesmo arquivo de cabeçalhos do nginx |
| `pnpm dev:api` persistente | executado manualmente: sobe em ~16 s, cadastro e autenticação respondem |
| Dockerfile, `docker-compose.yml`, `nginx.conf`, workflow de CI | **não executados** |
