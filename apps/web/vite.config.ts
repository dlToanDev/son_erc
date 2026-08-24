import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// FE build tĩnh; dev proxy /api → NestJS API (khớp mô hình 1 domain của production).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Bundle thẳng source TS của shared — tránh vấn đề CJS named-export với Rollup.
      '@debtflow/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
