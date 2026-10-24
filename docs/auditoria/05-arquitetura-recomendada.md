# 5. Arquitetura web recomendada

Monorepo pnpm:

```
apps/web        React + Vite + TS estrito + Tailwind + Zustand
apps/api        NestJS + Prisma + WebSocket
apps/worker     consumidor de filas (render FFmpeg, IA)
packages/project-schema   modelo de projeto versionado (Zod), fonte única de verdade
packages/render-core      conversão timeline -> grafo de filtros FFmpeg
packages/effects          definição declarativa de efeitos (params + preview + render)
```

Princípios:
- O **modelo de projeto** (JSON versionado, serializável) é compartilhado por preview e renderizador.
- Cada efeito declara parâmetros, shader de preview (WebGL) e filtro FFmpeg equivalente.
- Preview: WebGL/Canvas + Web Audio; proxies de baixa resolução para mídias pesadas.
- Render: servidor via fila; FFmpeg executado só com argumentos montados pelo backend (nunca comandos do cliente).
- Híbrido: local (WebCodecs/ffmpeg.wasm) para tarefas leves, servidor para pesadas.
