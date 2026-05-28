import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL || 'http://localhost';
const chromePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const dossierId = '0a9816e8-7824-4cad-97e5-f99aa62ce4f5';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loginAsJean(page) {
  await page.goto(`${baseURL}/back-office/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[type="email"]').fill('jean@bicec.cm');
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('heading', { name: /file de validation/i }).waitFor({ timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function readMetrics(page) {
  async function metric(id) {
    return page.getByTestId(id).locator('.text-2xl').innerText();
  }
  return {
    pending: await metric('queue-stat-pending'),
    infoRequired: await metric('queue-stat-info-required'),
    aml: await metric('queue-stat-aml'),
    approved: await metric('queue-stat-approved'),
  };
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const consoleEntries = [];
  const pageErrors = [];
  const failedRequests = [];
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.url().includes('/sentry-proxy') && request.failure()?.errorText === 'net::ERR_ABORTED') {
      return;
    }
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
  });

  await loginAsJean(page);
  const notificationCount = await page.getByRole('button', { name: /notifications/i }).count();
  assert(notificationCount === 0, `Notifications button is still present (${notificationCount})`);

  const activeMetrics = await readMetrics(page);
  await page.screenshot({
    path: path.join(screenshotDir, 'agent-ux-validation-active-filter.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: /active/i }).click();
  await page.locator('.cursor-pointer', { hasText: /approuv/i }).last().click();
  await page.getByRole('button', { name: /approved/i }).waitFor({ timeout: 10000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const approvedMetrics = await readMetrics(page);
  await page.screenshot({
    path: path.join(screenshotDir, 'agent-ux-validation-approved-filter.png'),
    fullPage: true,
  });
  assert(
    JSON.stringify(activeMetrics) === JSON.stringify(approvedMetrics),
    `Queue metrics changed after filtering: ${JSON.stringify({ activeMetrics, approvedMetrics })}`,
  );

  const tabletPage = await context.newPage();
  await tabletPage.setViewportSize({ width: 785, height: 400 });
  await tabletPage.goto(`${baseURL}/back-office/validation/dossier/${dossierId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await tabletPage.getByText('+237699035909').waitFor({ timeout: 30000 });
  await tabletPage.getByTestId('evidence-document-tabs').waitFor({ timeout: 10000 });
  await tabletPage.waitForLoadState('networkidle').catch(() => {});

  const tabsLayout = await tabletPage.getByTestId('evidence-document-tabs').evaluate((container) => {
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
  await tabletPage.screenshot({
    path: path.join(screenshotDir, 'agent-ux-evidence-tablet-tabs.png'),
    fullPage: true,
  });
  assert(tabsLayout.containerWidth > 0, 'Evidence tabs container is not visible');
  assert(tabsLayout.containerRight <= tabsLayout.viewportWidth + 1, `Tabs container overflows viewport: ${JSON.stringify(tabsLayout)}`);
  assert(tabsLayout.overflowingButtons.length === 0, `Tabs buttons overflow: ${JSON.stringify(tabsLayout)}`);

  const report = {
    date: new Date().toISOString(),
    baseURL,
    activeMetrics,
    approvedMetrics,
    notificationCount,
    tabsLayout,
    pageErrors,
    failedRequests,
    consoleEntries,
  };
  await fs.writeFile(
    path.join(screenshotDir, 'agent-ux-regression-proof-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  );
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
