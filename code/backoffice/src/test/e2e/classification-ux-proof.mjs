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

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  const videoDir = path.join(screenshotDir, 'videos');
  await fs.mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 785, height: 400 },
    recordVideo: {
      dir: videoDir,
      size: { width: 785, height: 400 },
    },
  });
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  const failedRequests = [];

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
  await page.goto(`${baseURL}/back-office/validation/dossier/${dossierId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.getByText('+237699035909').waitFor({ timeout: 30000 });
  await page.getByTestId('document-classification-compact').waitFor({ timeout: 10000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-compact.png'),
    fullPage: true,
  });
  await page.getByTestId('document-classification-compact').evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(250);
  await page.getByTestId('document-classification-compact').screenshot({
    path: path.join(screenshotDir, 'classification-ux-compact-card.png'),
  });

  const formBeforeClick = await page.getByTestId('document-classification-form').count();
  const compactText = await page.getByTestId('document-classification-compact').innerText();
  assert(formBeforeClick === 0, 'Classification form should be hidden for an already classified CNI');
  assert(/Document classe/i.test(compactText), `Compact classification state is missing: ${compactText}`);
  assert(/CNI_RECTO/i.test(compactText), `Compact classification does not expose CNI_RECTO: ${compactText}`);

  await page.getByRole('button', { name: /reclasser/i }).click();
  await page.getByTestId('document-classification-form').waitFor({ timeout: 10000 });
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-form-open.png'),
    fullPage: true,
  });
  await page.getByTestId('document-classification-form').evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(250);
  await page.getByTestId('document-classification-form').screenshot({
    path: path.join(screenshotDir, 'classification-ux-form-card.png'),
  });

  const formText = await page.getByTestId('document-classification-form').innerText();
  assert(/Reclasser le document/i.test(formText), `Reclassify form did not open: ${formText}`);
  assert(/Type principal/i.test(formText), `Reclassify form is missing primary type field: ${formText}`);
  assert(/Categories/i.test(formText), `Reclassify form is missing categories field: ${formText}`);

  await page.getByRole('button', { name: /annuler/i }).click();
  await page.getByTestId('document-classification-compact').waitFor({ timeout: 10000 });
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-after-cancel.png'),
    fullPage: true,
  });

  const report = {
    date: new Date().toISOString(),
    baseURL,
    compactText,
    formBeforeClick,
    formText,
    pageErrors,
    failedRequests,
    consoleEntries,
  };
  await fs.writeFile(
    path.join(screenshotDir, 'classification-ux-proof-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  );

  const video = page.video();
  await context.close();
  if (video) {
    const videoPath = await video.path();
    await fs.copyFile(videoPath, path.join(videoDir, 'classification-ux-demo.webm'));
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
