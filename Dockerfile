# syntax=docker/dockerfile:1
# Imagens: `api` (Node + FFmpeg empacotado) e `web` (nginx servindo o build estático).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates fontconfig fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @editor/api exec prisma generate

FROM base AS web-build
RUN pnpm --filter @editor/web build

FROM nginx:1.27-alpine AS web
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 80

FROM base AS api
ENV NODE_ENV=production PORT=3001 STORAGE_DIR=/data/storage TEMP_DIR=/data/tmp TRUST_PROXY=1
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica as migrações versionadas e inicia a API.
CMD ["sh", "-c", "pnpm --filter @editor/api exec prisma migrate deploy && pnpm --filter @editor/api exec tsx src/main.ts"]
