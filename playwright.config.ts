import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: [
    { command: 'npm run dev:demo -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'node scripts/smoke-server.mjs', url: 'http://127.0.0.1:48731', reuseExistingServer: false },
  ],
});
