import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const dossierId = '0a9816e8-7824-4cad-97e5-f99aa62ce4f5';

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

test.describe('Evidence - dossier viewer fixes', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('no passive wheel error and no blob CSP framing error on dossier viewer', async ({ page }) => {
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
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    });

    await loginAsJean(page);
    await page.goto(`/back-office/validation/dossier/${dossierId}`);
    await expect(page.getByText('+237699035909')).toBeVisible({ timeout: 20000 });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(screenshotDir, 'evidence-dossier-fixes-desktop.png'),
      fullPage: true,
    });

    const image = page.locator('img[alt="CNI_RECTO"]').first();
    await expect(image).toBeVisible({ timeout: 10000 });
    const box = await image.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -240);
      await page.mouse.wheel(0, 240);
    }

    const addressTab = page.locator('button:has-text("ADDRESS_PROOF")').first();
    await addressTab.click();
    await page.waitForTimeout(800);

    await page.setViewportSize({ width: 400, height: 785 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join(screenshotDir, 'evidence-dossier-fixes-mobile.png'),
      fullPage: true,
    });

    const passiveWheelErrors = consoleEntries.filter((entry) =>
      /Unable to preventDefault inside passive event listener invocation/i.test(entry.text),
    );
    const blobCspErrors = consoleEntries.filter((entry) =>
      /Framing 'blob:'|violates the following Content Security Policy directive/i.test(entry.text),
    );

    const report = {
      date: new Date().toISOString(),
      route: `/back-office/validation/dossier/${dossierId}`,
      passiveWheelErrors,
      blobCspErrors,
      pageErrors,
      failedRequests,
      consoleEntries,
    };
    fs.writeFileSync(
      path.join(screenshotDir, 'evidence-dossier-fixes-console-report.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );

    expect(passiveWheelErrors).toEqual([]);
    expect(blobCspErrors).toEqual([]);
  });
});
