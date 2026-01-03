import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './pw-e2e',
  retries: 0,
  timeout: 660_000, // 11 minutes - Message Batches API takes 2-10 min
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:full',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
