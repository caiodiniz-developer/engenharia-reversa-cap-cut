# 8. Plano de implementação do MVP (Fases 2–4)

1. Monorepo pnpm, tsconfig estrito, lint, vitest.
2. `project-schema`: tipos Zod de Projeto/Faixa/Clipe, versão de schema, migrações.
3. Timeline puro (sem UI): operações split/trim/move/delete + undo/redo, com testes.
4. UI: layout com painéis redimensionáveis, biblioteca, timeline, propriedades.
5. Importação de mídia e metadados (ffprobe no backend), thumbnails.
6. Preview Canvas/Web Audio sincronizado com a timeline.
7. API: auth, CRUD de projetos, autosave, versões.
8. `render-core`: timeline -> comando FFmpeg (concat, trim, scale, áudio).
9. Worker + fila + progresso por WebSocket + cancelamento + download assinado.
10. Teste E2E: importar 3 clipes, cortar, exportar e validar a saída com ffprobe.
