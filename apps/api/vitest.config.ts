import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 90_000,
    hookTimeout: 120_000,
    // Os testes compartilham um PostgreSQL e usam FFmpeg: sem paralelismo entre arquivos.
    fileParallelism: false,
  },
});
