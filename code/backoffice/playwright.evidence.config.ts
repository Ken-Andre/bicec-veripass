import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  outputDir: '../../docs/test-evidence/latest/backoffice',
  reporter: [['html', { outputFolder: '../../docs/test-evidence/latest/backoffice/html-report' }]],
  webServer: {
    ...baseConfig.webServer,
    command: 'npm run dev -- --host 127.0.0.1 --port 3002 --strictPort',
    url: 'http://127.0.0.1:3002/back-office/login',
  },
  use: {
    ...baseConfig.use,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
