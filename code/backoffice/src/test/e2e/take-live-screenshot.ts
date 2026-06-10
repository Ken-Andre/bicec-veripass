import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
  fs.mkdirSync(screenshotDir, { recursive: true });

  console.log('Step 1: Launching headless Chromium browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Step 2: Navigating to Backoffice Login Page...');
  await page.goto('http://localhost:3001/back-office/login');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, 'live-step1-login-page.png') });
  console.log('Captured step 1: live-step1-login-page.png');

  console.log('Step 3: Entering administrator credentials...');
  await page.fill('input[type="email"]', 'admin@bicec.cm');
  await page.fill('input[type="password"]', 'password123');
  await page.screenshot({ path: path.join(screenshotDir, 'live-step2-credentials-filled.png') });
  console.log('Captured step 2: live-step2-credentials-filled.png');

  console.log('Step 4: Submitting login form...');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ url: /.*\/admin.*/, timeout: 10000 });
  await page.waitForTimeout(3000); // Allow data to fetch and render fully
  await page.screenshot({ path: path.join(screenshotDir, 'live-step3-admin-dashboard.png') });
  console.log('Captured step 3: live-step3-admin-dashboard.png');

  await browser.close();
  console.log('Live browser session closed successfully!');
}

run().catch(err => {
  console.error('Error during live browser check:', err);
  process.exit(1);
});
