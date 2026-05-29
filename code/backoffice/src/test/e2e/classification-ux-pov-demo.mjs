import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL || 'http://localhost';
const chromePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/backoffice/screens');
const dossierId = '0a9816e8-7824-4cad-97e5-f99aa62ce4f5';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginAsJean(page) {
  await page.goto(`${baseURL}/back-office/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[type="email"]').fill('jean@bicec.cm');
  await page.locator('input[type="password"]').fill('password123');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function scrollForAgentView(page, locator) {
  await locator.evaluate((element) => {
    const top = element.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
  await pause(900);
}

async function moveAndClick(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Target not visible for click');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await pause(700);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
    viewport: { width: 1366, height: 768 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1366, height: 768 },
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
  await page.waitForLoadState('networkidle').catch(() => {});

  const compact = page.getByTestId('document-classification-compact');
  await compact.waitFor({ timeout: 30000 });
  await scrollForAgentView(page, compact);
  await pause(2200);
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-pov-compact.png'),
    fullPage: false,
  });

  await moveAndClick(page, page.getByRole('button', { name: /reclasser/i }));
  const form = page.getByTestId('document-classification-form');
  await form.waitFor({ timeout: 10000 });
  await scrollForAgentView(page, form);
  await pause(1800);
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-pov-form-open.png'),
    fullPage: false,
  });

  const reason = page.locator('textarea[placeholder="Justification"]');
  await page.mouse.move(80, 560, { steps: 18 });
  await reason.click();
  await pause(600);
  await reason.pressSequentially('Correction de classement - demonstration seulement', { delay: 45 });
  await pause(1800);
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-pov-typed.png'),
    fullPage: false,
  });

  await moveAndClick(page, page.getByRole('button', { name: /annuler/i }));
  await compact.waitFor({ timeout: 10000 });
  await pause(1800);
  await page.screenshot({
    path: path.join(screenshotDir, 'classification-ux-pov-after-cancel.png'),
    fullPage: false,
  });

  const report = {
    date: new Date().toISOString(),
    baseURL,
    viewport: { width: 1366, height: 768 },
    mutatedDossier: false,
    pageErrors,
    failedRequests,
    consoleEntries,
  };
  await fs.writeFile(
    path.join(screenshotDir, 'classification-ux-pov-demo-report.json'),
    JSON.stringify(report, null, 2),
    'utf-8',
  );

  const video = page.video();
  await context.close();
  if (video) {
    const videoPath = await video.path();
    await fs.copyFile(videoPath, path.join(videoDir, 'classification-ux-pov-demo.webm'));
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
