import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');

test.describe('Live GAB step-by-step evidence', () => {
  test('Capture live steps', async ({ page }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });

    console.log('Step 1: Navigating to Backoffice Login Page...');
    await page.goto('/back-office/login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, 'live-step1-login-page.png'), fullPage: true });
    
    console.log('Step 2: Entering admin credentials...');
    await page.fill('input[type="email"]', 'admin@bicec.cm');
    await page.fill('input[type="password"]', 'password123');
    await page.screenshot({ path: path.join(screenshotDir, 'live-step2-credentials-filled.png'), fullPage: true });

    console.log('Step 3: Clicking connection and waiting for redirection to admin dashboard...');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: /administration/i })).toBeVisible({ timeout: 15000 });
    
    // Wait for the GAB table/grid to fetch and render
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotDir, 'live-step3-admin-dashboard.png'), fullPage: true });
    
    console.log('Step-by-step screenshots generated successfully!');
  });
});
