import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const api = process.env.API_ORIGIN ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR,
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    // Em desenvolvimento o navegador fala só com o Vite (mesma origem): sem CORS e vídeo/canvas sem "taint".
    proxy: {
      '/api': api,
      '/ws': { target: api.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: { sourcemap: true, target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
