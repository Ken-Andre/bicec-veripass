import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/e2e',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
