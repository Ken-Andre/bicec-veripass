import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const dossierId = '0a9816e8-7824-4cad-97e5-f99aa62ce4f5';

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function loginAsThomas(page: Page) {
  await page.goto('/back-office/login');
  await page.fill('input[type="email"]', 'thomas@bicec.cm');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: /conformit/i })).toBeVisible({ timeout: 20000 });
}

test.describe('Thomas operational audit evidence', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('capture real operational blockers for Thomas', async ({ page }) => {
    const report: Record<string, unknown> = {
      date: new Date().toISOString(),
      persona: 'THOMAS',
      routeChecks: {},
      blockers: [] as Array<Record<string, string>>,
      alertsCount: 0,
      conflictsCount: 0,
    };

    await loginAsThomas(page);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'thomas-audit-01-compliance-dashboard.png');

    const openAlertsCard = page.getByText(/alertes ouvertes/i).first();
    const conflictsCard = page.getByText(/conflits niu/i).first();
    report.routeChecks = {
      compliance_dashboard_visible: await openAlertsCard.isVisible().catch(() => false),
      niu_card_visible: await conflictsCard.isVisible().catch(() => false),
    };

    // Go to first alert detail if any
    const treatButtons = page.getByRole('button', { name: /traiter/i });
    const treatCount = await treatButtons.count();
    report.alertsCount = treatCount;
    if (treatCount > 0) {
      await treatButtons.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /alerte aml/i })).toBeVisible({ timeout: 10000 });
      await screenshot(page, 'thomas-audit-02-alert-detail.png');
    } else {
      (report.blockers as Array<Record<string, string>>).push({
        severity: 'P1',
        id: 'THOMAS_NO_ALERT_DATA',
        detail: 'Aucune alerte affichée dans la table; impossible de vérifier un traitement complet.',
      });
    }

    // Go to NIU conflicts page
    await page.goto('/back-office/compliance/duplicates');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /conflits niu/i })).toBeVisible({ timeout: 10000 });
    await screenshot(page, 'thomas-audit-03-niu-conflicts.png');

    const examineButtons = page.getByRole('button', { name: /examiner/i });
    const conflictsCount = await examineButtons.count();
    report.conflictsCount = conflictsCount;
    if (conflictsCount > 0) {
      await examineButtons.first().click();
      await page.waitForTimeout(500);
      await screenshot(page, 'thomas-audit-04-niu-conflict-detail.png');
    } else {
      (report.blockers as Array<Record<string, string>>).push({
        severity: 'P1',
        id: 'THOMAS_NO_CONFLICT_DATA',
        detail: 'Aucun conflit NIU disponible; impossible de valider le workflow Fusionner/Marquer fraude.',
      });
    }

    // Analytics is available for Thomas
    await page.goto('/back-office/analytics');
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'thomas-audit-05-analytics.png');
    const analyticsVisible = await page.getByRole('heading', { name: /analytics/i }).first().isVisible().catch(() => false);
    if (!analyticsVisible) {
      (report.blockers as Array<Record<string, string>>).push({
        severity: 'P1',
        id: 'THOMAS_ANALYTICS_VISIBILITY',
        detail: 'Route /analytics accessible mais le titre Analytics n’est pas visible.',
      });
    }

    // Critical check: Thomas cannot open dossier viewer from route guard
    await page.goto(`/back-office/validation/dossier/${dossierId}`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'thomas-audit-06-dossier-access-attempt.png');
    const unauthorizedVisible = await page.getByText(/acc[eè]s refus[eé]|unauthorized|non autoris/i).first().isVisible().catch(() => false);
    if (unauthorizedVisible) {
      (report.blockers as Array<Record<string, string>>).push({
        severity: 'P0',
        id: 'THOMAS_CANNOT_OPEN_DOSSIER_VIEWER',
        detail: 'Le frontend interdit /validation/dossier/:id à THOMAS alors que son rôle conformité doit pouvoir investiguer un dossier lié à une alerte AML.',
      });
    }

    fs.writeFileSync(
      path.join(screenshotDir, 'thomas-operational-audit-report.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
  });
});
