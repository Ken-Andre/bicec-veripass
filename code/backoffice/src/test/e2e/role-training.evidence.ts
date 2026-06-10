import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const kycProofPath = path.resolve(
  process.cwd(),
  '../../docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json',
);

const roles = [
  {
    key: 'jean',
    email: 'jean@bicec.cm',
    home: /file de validation/i,
    screenshot: 'role-jean-validation.png',
    routes: ['/validation'],
  },
  {
    key: 'thomas',
    email: 'thomas@bicec.cm',
    home: /conformit/i,
    screenshot: 'role-thomas-compliance.png',
    routes: ['/compliance', '/analytics'],
  },
  {
    key: 'sylvie',
    email: 'sylvie@bicec.cm',
    home: /command center/i,
    screenshot: 'role-sylvie-command-center.png',
    routes: ['/command-center', '/analytics'],
  },
  {
    key: 'admin',
    email: 'admin@bicec.cm',
    home: /administration/i,
    screenshot: 'role-admin-it.png',
    routes: ['/admin'],
  },
];

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function screenshotEvidence(page: Page, filename: string) {
  const target = path.join(screenshotDir, filename);
  try {
    await page.screenshot({ path: target, fullPage: true });
  } catch {
    const parsed = path.parse(filename);
    const fallback = path.join(screenshotDir, `${parsed.name}-${Date.now()}${parsed.ext}`);
    await page.screenshot({ path: fallback, fullPage: true });
  }
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

async function login(page: Page, email: string) {
  await page.goto('/back-office/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
}

test.describe('Backoffice role training evidence', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  for (const role of roles) {
    test(`${role.key} profile can access its operational surfaces`, async ({ page }) => {
      const badResponses = collectBadResponses(page);
      await login(page, role.email);
      await expect(page.getByRole('heading', { name: role.home })).toBeVisible({ timeout: 15000 });
      await screenshotEvidence(page, role.screenshot);

      for (const route of role.routes) {
        await page.goto(`/back-office${route}`);
        await page.waitForLoadState('networkidle');
        await screenshotEvidence(page, `role-${role.key}-${route.replace(/\//g, '-').replace(/^-/, '')}.png`);
      }

      expect(badResponses).toEqual([]);
    });
  }

  test('JEAN opens the final approved dossier during training', async ({ page }) => {
    test.skip(!fs.existsSync(kycProofPath), 'Run code/scripts/run_kyc_happy_path_acceptance.py first.');
    const badResponses = collectBadResponses(page);
    const proof = JSON.parse(fs.readFileSync(kycProofPath, 'utf-8')) as { raw_session_id: string };

    await login(page, 'jean@bicec.cm');
    await expect(page.getByRole('heading', { name: /file de validation/i })).toBeVisible({ timeout: 15000 });
    await page.evaluate((id) => {
      window.history.pushState(null, '', `/back-office/validation/dossier/${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, proof.raw_session_id);
    await expect(page.getByText(proof.raw_session_id.slice(0, 8))).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('APPROVED').first()).toBeVisible({ timeout: 15000 });
    await screenshotEvidence(page, 'role-jean-approved-dossier-training.png');

    expect(badResponses).toEqual([]);
  });
});
