# 9. Critérios de aceitação do MVP

- Importar 3 vídeos de teste, ordená-los, dividir o 2º e remover um trecho.
- Recarregar a página e recuperar o projeto idêntico (round-trip do JSON).
- Undo/redo restaura estados exatos.
- Exportar MP4: duração, resolução e FPS conferem via ffprobe, com tolerância de 1 quadro.
- Quadro exportado em tempos-chave coincide com o preview (diferença visual dentro de limite definido).
- Usuário A não acessa projetos/mídias do usuário B.
- Cancelar exportação interrompe o FFmpeg e limpa temporários.
- `pnpm test`, `pnpm build` e `pnpm e2e` passam sem erros.
