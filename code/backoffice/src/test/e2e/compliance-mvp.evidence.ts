import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function screenshotEvidence(page: Page, filename: string) {
  const target = path.join(screenshotDir, filename);
  await page.screenshot({ path: target, fullPage: true });
}

async function loginThomas(page: Page) {
  await page.goto('/back-office/login');
  await page.fill('input[type="email"]', 'thomas@bicec.cm');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: /conformit/i })).toBeVisible({ timeout: 15000 });
}

test.describe('Compliance MVP evidence', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('THOMAS compliance dashboard and NIU conflict resolver are visible', async ({ page }) => {
    await loginThomas(page);
    await page.waitForLoadState('networkidle');
    await screenshotEvidence(page, 'mvp-thomas-compliance-dashboard.png');

    await page.getByRole('button', { name: /conflits niu/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /niu/i })).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await screenshotEvidence(page, 'mvp-thomas-niu-conflicts.png');
  });
});
