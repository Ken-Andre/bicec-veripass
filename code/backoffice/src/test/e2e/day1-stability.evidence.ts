import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const kycProofPath = path.resolve(
  process.cwd(),
  '../../docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json',
);

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

function collectBadResponses(page: Page) {
  const badResponses: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 500) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return badResponses;
}

test.describe('Day 1 backoffice evidence', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('backoffice login and dashboard render without 5xx responses', async ({ page }) => {
    const badResponses = collectBadResponses(page);

    await page.goto('/back-office/login');
    await expect(page.getByRole('heading', { name: /bicec veripass/i })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'login.png'), fullPage: true });

    await page.fill('input[type="email"]', 'jean@bicec.cm');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/file de validation/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, 'dashboard.png'), fullPage: true });

    expect(badResponses).toEqual([]);
  });

  test('JEAN can open the live accepted KYC dossier proof', async ({ page }) => {
    test.skip(!fs.existsSync(kycProofPath), 'Run code/scripts/run_kyc_happy_path_acceptance.py first.');
    const badResponses = collectBadResponses(page);
    const proof = JSON.parse(fs.readFileSync(kycProofPath, 'utf-8'));
    const sessionId = proof.raw_session_id;

    await page.goto('/back-office/login');
    await page.fill('input[type="email"]', 'jean@bicec.cm');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/file de validation/i)).toBeVisible({ timeout: 15000 });

    await page.evaluate((id) => {
      window.history.pushState(null, '', `/back-office/validation/dossier/${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, sessionId);
    await expect(page.getByText(sessionId.slice(0, 8))).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('APPROVED').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, 'kyc-happy-path-approved-dossier.png'), fullPage: true });

    expect(badResponses).toEqual([]);
  });
});
