import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const dossierId = '0a9816e8-7824-4cad-97e5-f99aa62ce4f5';

type QueueMetrics = {
  pending: string;
  infoRequired: string;
  aml: string;
  approved: string;
};

type ConsoleEntry = {
  type: string;
  text: string;
  location: string;
};

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

function normalizeLocation(message: ConsoleMessage): string {
  const location = message.location();
  if (!location.url) return 'unknown';
  return `${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`;
}

async function loginAsJean(page: Page) {
  await page.goto('/back-office/login');
  await page.fill('input[type="email"]', 'jean@bicec.cm');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: /file de validation/i })).toBeVisible({ timeout: 20000 });
}

async function readQueueMetrics(page: Page): Promise<QueueMetrics> {
  return {
    pending: await page.getByTestId('queue-stat-pending').locator('.text-2xl').innerText(),
    infoRequired: await page.getByTestId('queue-stat-info-required').locator('.text-2xl').innerText(),
    aml: await page.getByTestId('queue-stat-aml').locator('.text-2xl').innerText(),
    approved: await page.getByTestId('queue-stat-approved').locator('.text-2xl').innerText(),
  };
}

test.describe('Agent UX regressions', () => {
  test.setTimeout(90_000);

  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('Jean queue metrics stay stable when filtering and dead notification button is absent', async ({ page }) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
        location: normalizeLocation(message),
      });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    });

    await loginAsJean(page);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /notifications/i })).toHaveCount(0);

    const activeMetrics = await readQueueMetrics(page);
    await page.screenshot({
      path: path.join(screenshotDir, 'agent-ux-validation-active-filter.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: /active/i }).click();
    await page.locator('.cursor-pointer', { hasText: /approuv/i }).last().click();
    await expect(page.getByRole('button', { name: /approved/i })).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const approvedMetrics = await readQueueMetrics(page);
    await page.screenshot({
      path: path.join(screenshotDir, 'agent-ux-validation-approved-filter.png'),
      fullPage: true,
    });

    const report = {
      date: new Date().toISOString(),
      route: '/back-office/validation',
      activeMetrics,
      approvedMetrics,
      pageErrors,
      failedRequests,
      consoleEntries,
    };
    fs.writeFileSync(
      path.join(screenshotDir, 'agent-ux-validation-filter-report.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );

    expect(approvedMetrics).toEqual(activeMetrics);
    expect(pageErrors).toEqual([]);
  });

  test('evidence document tabs fit tablet widths', async ({ page }) => {
    await page.setViewportSize({ width: 785, height: 400 });
    await loginAsJean(page);
    await page.goto(`/back-office/validation/dossier/${dossierId}`);
    await expect(page.getByText('+237699035909')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('evidence-document-tabs')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const tabsLayout = await page.getByTestId('evidence-document-tabs').evaluate((container) => {
      const containerRect = container.getBoundingClientRect();
      const buttons = Array.from(container.querySelectorAll('button')).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.textContent?.trim() ?? '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
      return {
        viewportWidth: window.innerWidth,
        containerLeft: containerRect.left,
        containerRight: containerRect.right,
        containerWidth: containerRect.width,
        overflowingButtons: buttons.filter(
          (button) =>
            button.left < containerRect.left - 1 ||
            button.right > containerRect.right + 1 ||
            button.right > window.innerWidth + 1,
        ),
      };
    });

    await page.screenshot({
      path: path.join(screenshotDir, 'agent-ux-evidence-tablet-tabs.png'),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(screenshotDir, 'agent-ux-evidence-tablet-tabs-report.json'),
      JSON.stringify({ date: new Date().toISOString(), route: `/back-office/validation/dossier/${dossierId}`, tabsLayout }, null, 2),
      'utf-8',
    );

    expect(tabsLayout.containerWidth).toBeGreaterThan(0);
    expect(tabsLayout.containerRight).toBeLessThanOrEqual(tabsLayout.viewportWidth + 1);
    expect(tabsLayout.overflowingButtons).toEqual([]);
  });
});
