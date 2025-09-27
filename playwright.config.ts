import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './pw-e2e',
  retries: 0,
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

