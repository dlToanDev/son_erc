import { defineConfig } from '@playwright/test';

// Smoke test — cần stack chạy sẵn: postgres + api (:3000) + web dev (:5173).
// Chạy: npm run test:smoke --workspace apps/web
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    headless: true,
  },
  reporter: [['list']],
});
