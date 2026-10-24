# 7. Dependências necessárias

## Ferramentas do sistema (faltam instalar)
- FFmpeg + FFprobe
- PostgreSQL 16 (ou Docker Desktop)
- Redis, para a fila BullMQ (ou Docker Desktop)

## Frontend
react, react-dom, react-router, zustand, framer-motion, gsap (só se justificado), tailwindcss, vite, typescript, vitest, @testing-library/react, playwright

## Backend
@nestjs/*, prisma, @prisma/client, bullmq, ioredis, zod, argon2, @nestjs/throttler, @nestjs/websockets, tus (upload resumível), spawn direto do FFmpeg, SDK S3 (MinIO em dev)

## IA
whisper.cpp ou faster-whisper (local), ou API externa com chaves só no backend

Cada dependência será adicionada no commit que a usa, com justificativa.
