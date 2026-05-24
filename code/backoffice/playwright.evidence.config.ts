import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const liveBaseURL = process.env.BASE_URL;

export default defineConfig({
  ...baseConfig,
  testMatch: /.*\.evidence\.ts/,
  workers: 1,
  outputDir: '../../docs/test-evidence/latest/backoffice/_playwright',
  reporter: [['html', { outputFolder: '../../docs/test-evidence/latest/backoffice-html-report' }]],
  webServer: liveBaseURL ? undefined : {
    ...baseConfig.webServer,
    command: 'npm run dev -- --host 127.0.0.1 --port 3002 --strictPort',
    url: 'http://127.0.0.1:3002/back-office/login',
  },
  use: {
    ...baseConfig.use,
    baseURL: liveBaseURL || baseConfig.use?.baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
