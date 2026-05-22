import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  testMatch: /.*\.evidence\.ts/,
  workers: 1,
  outputDir: '../../docs/test-evidence/latest/mobile',
  reporter: [['html', { outputFolder: '../../docs/test-evidence/latest/mobile-html-report' }]],
  projects: [baseConfig.projects?.[0]].filter(Boolean),
  use: {
    ...baseConfig.use,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
