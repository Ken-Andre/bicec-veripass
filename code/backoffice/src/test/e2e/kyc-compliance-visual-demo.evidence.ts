import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const evidenceDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/kyc-compliance-demo');
const screenshotDir = path.join(evidenceDir, 'screens');
const demoSessionId = process.env.DEMO_KYC_SESSION_ID || '6146be49-13c6-4331-8163-971b3069d853';

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
}

async function resetBackoffice(page: Page) {
  await page.goto('/back-office/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function loginBackoffice(page: Page, email: string, expectedUrl: RegExp) {
  await resetBackoffice(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(expectedUrl, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('KYC compliance visual demo evidence', () => {
  test.setTimeout(180000);

  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('captures AML registry, role gating, biometric override and mobile document scope', async ({ page }) => {
    const source = `A_BICEC_VISUAL_DEMO_${Date.now()}`;
    const invalidCsv = [
      'source,list_type,entity_type,full_name,aliases,date_of_birth,nationality,programs,is_active',
      `${source},PEP,INDIVIDUAL,,Alias Demo,,CM,INTERNAL_WATCHLIST,true`,
      '',
    ].join('\n');
    const validCsv = [
      'source,list_type,entity_type,full_name,aliases,date_of_birth,nationality,programs,is_active',
      `${source},PEP,INDIVIDUAL,Visual Demo Import,Alias Demo,,CM,INTERNAL_WATCHLIST,true`,
      '',
    ].join('\n');

    await loginBackoffice(page, 'thomas@bicec.cm', /\/back-office\/compliance/);
    await expect(page.getByRole('button', { name: /listes aml/i })).toBeVisible();
    await screenshot(page, '01-thomas-dashboard-listes-aml-entry.png');

    await page.getByRole('button', { name: /listes aml/i }).click();
    await expect(page.getByRole('heading', { name: /listes aml/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/sources opensanctions/i)).toBeVisible();
    await screenshot(page, '02-thomas-aml-registry-import-surface.png');

    await page.setInputFiles('input[type="file"]', {
      name: 'invalid-aml-demo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv, 'utf-8'),
    });
    await page.getByRole('button', { name: /valider le csv/i }).click();
    await expect(page.getByText(/full_name is required/i)).toBeVisible({ timeout: 15000 });
    await screenshot(page, '03-thomas-aml-dry-run-validation-error.png');

    await page.setInputFiles('input[type="file"]', {
      name: 'valid-aml-demo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(validCsv, 'utf-8'),
    });
    await page.getByRole('button', { name: /valider le csv/i }).click();
    await expect(page.getByText(/DRY_RUN/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /confirmer l'import/i })).toBeEnabled();
    await screenshot(page, '04-thomas-aml-dry-run-ok-confirm-enabled.png');

    await page.getByRole('button', { name: /confirmer l'import/i }).click();
    await expect(page.getByText(/IMPORTED/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(source)).toBeVisible({ timeout: 15000 });
    await screenshot(page, '05-thomas-aml-imported-source-in-registry.png');

    await loginBackoffice(page, 'jean@bicec.cm', /\/back-office\/validation/);
    await page.goto('/back-office/compliance/lists');
    await expect(page.getByRole('heading', { name: /acc/i })).toBeVisible({ timeout: 15000 });
    await screenshot(page, '06-jean-cannot-manage-aml-lists.png');

    await page.goto('/back-office/validation');
    await expect(page.getByRole('heading', { name: /file de validation/i })).toBeVisible({ timeout: 15000 });
    await page.fill('input[placeholder*="Rechercher"]', 'Client Demo Biometrie AML');
    await expect(page.getByText('Client Demo Biometrie AML')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Biometrie', { exact: true })).toBeVisible();
    await screenshot(page, '07-jean-queue-biometric-priority-flag.png');

    await page.goto(`/back-office/validation/dossier/${demoSessionId}`);
    await expect(page.getByText('Client Demo Biometrie AML')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/revue biometrie obligatoire/i)).toBeVisible();
    await expect(page.getByText(/alertes aml liees/i)).toBeVisible();
    await expect(page.getByText(/suivi thomas/i)).toBeVisible();
    await screenshot(page, '08-jean-dossier-biometric-risk-and-aml-alert.png');

    await page.getByRole('button', { name: /approuver/i }).click();
    await page.fill('textarea', 'Verification manuelle effectuee pour demo encadreur.');
    await expect(page.getByText(/signal biometrie a arbitrer/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmer l'approbation/i })).toBeDisabled();
    await screenshot(page, '09-jean-approval-requires-biometric-override.png');

    await page.getByLabel(/je confirme avoir arbitre/i).check();
    await expect(page.getByRole('button', { name: /confirmer l'approbation/i })).toBeEnabled();
    await page.getByRole('button', { name: /confirmer l'approbation/i }).click();
    await expect(page.getByText(/open aml alerts must be cleared/i)).toBeVisible({ timeout: 15000 });
    await screenshot(page, '10-jean-approval-blocked-by-open-aml-alert.png');

    await page.route('**/api/v1/kyc/session/current', async (route) => {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"detail":"demo skipped"}' });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mobile/auth');
    await page.evaluate(() => {
      localStorage.setItem('vp_token', 'visual-demo-token');
      localStorage.setItem('vp_device_tag', 'visual-demo-device');
      localStorage.setItem('vp_user', JSON.stringify({
        id: 'visual-demo-user',
        phone: '+237699880026',
        email: 'visual-demo-kyc@bicec-veripass.local',
        has_pin: false,
        biometric_opt_in: false,
        access_level: 'RESTRICTED',
      }));
      sessionStorage.removeItem('vp_is_locked');
    });
    await page.goto('/mobile/kyc/document-choice');
    await expect(page.getByText(/choix du document/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/passeport/i)).toBeVisible();
    await expect(page.getByText(/permis de conduire/i)).toBeVisible();
    await expect(page.getByText(/indisponible/i).first()).toBeVisible();
    await screenshot(page, '11-mobile-document-scope-cni-only-disabled-options.png');

    const report = [
      '# KYC Compliance Visual Demo',
      '',
      `Generated at: ${new Date().toISOString()}`,
      `Demo dossier: ${demoSessionId}`,
      `AML import source: ${source}`,
      '',
      '- 01 Thomas dashboard shows Listes AML entry.',
      '- 02 Thomas AML registry and CSV import surface.',
      '- 03 Invalid CSV dry-run shows row-level validation error.',
      '- 04 Valid dry-run enables explicit confirmation.',
      '- 05 Confirmed import appears in the AML registry.',
      '- 06 Jean cannot manage AML lists.',
      '- 07 Jean queue shows biometric priority flag.',
      '- 08 Jean dossier shows biometric risk plus AML alert as Thomas-followed.',
      '- 09 Approval requires explicit biometric override.',
      '- 10 Approval remains blocked while AML alert is open.',
      '- 11 Mobile document scope shows CNI enabled and passport/driver license disabled.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(evidenceDir, 'README.md'), report, 'utf-8');
  });
});
