import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  outputDir: '../../docs/test-evidence/latest/mobile',
  reporter: [['html', { outputFolder: '../../docs/test-evidence/latest/mobile/html-report' }]],
  use: {
    ...baseConfig.use,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
