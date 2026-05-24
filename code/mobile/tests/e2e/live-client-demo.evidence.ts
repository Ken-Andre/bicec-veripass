import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/mobile/screens');
const kycProofPath = path.resolve(
  process.cwd(),
  '../../docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json',
);
const demoPin = '135790';
const onePagePdf = '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF';

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

async function clearState(page: Page) {
  await page.goto('/mobile/auth');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function fillOtp(page: Page, otp: string) {
  const inputs = page.locator('input[inputmode="numeric"], input[type="text"]');
  await expect(inputs.first()).toBeVisible({ timeout: 10000 });
  for (const [index, digit] of [...otp].entries()) {
    await inputs.nth(index).fill(digit);
  }
}

async function clickPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit }).click();
  }
}

async function loginWithPhoneOtp(page: Page, phone: string) {
  const localPhone = phone.replace('+237', '');
  await page.goto('/mobile/');
  await page.screenshot({ path: path.join(screenshotDir, 'live-client-welcome.png'), fullPage: true });

  await page.getByRole('button', { name: /Me connecter/i }).click();
  await expect(page).toHaveURL(/\/mobile\/auth\/phone\?mode=login$/);
  await page.locator('input[type="tel"]').fill(localPhone);

  const otpResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/otp/send') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Envoyer le code/i }).click();
  const otpPayload = await (await otpResponsePromise).json() as { otp_debug?: string };
  expect(otpPayload.otp_debug, 'local Docker API must expose otp_debug outside production').toMatch(/^\d{6}$/);

  await fillOtp(page, otpPayload.otp_debug!);
  await page.getByRole('button', { name: /Valider le compte/i }).click();
}

async function completePinIfNeeded(page: Page) {
  await page.waitForURL(/\/mobile\/(auth\/pin-login|auth\/pin-setup|dashboard|kyc\/basic-profile)/, { timeout: 20000 });
  if (page.url().includes('/auth/pin-setup')) {
    await clickPin(page, demoPin);
    await page.waitForTimeout(500);
    await clickPin(page, demoPin);
  } else if (page.url().includes('/auth/pin-login')) {
    await clickPin(page, demoPin);
  }
  await page.waitForURL(/\/mobile\/(dashboard|kyc\/basic-profile)/, { timeout: 20000 });
}

test.describe('Live client demo evidence', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    ensureEvidenceDir();
    await clearState(page);
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 4.05, longitude: 9.7 });
  });

  test('returning client can log in, review support, upload a proof, and find offline DABs', async ({ page }) => {
    test.skip(!fs.existsSync(kycProofPath), 'Run code/scripts/run_kyc_happy_path_acceptance.py first.');
    const badResponses = collectBadResponses(page);
    const proof = JSON.parse(fs.readFileSync(kycProofPath, 'utf-8')) as { client_phone: string };
    const supportMessage = `Justificatif demo formation ${Date.now()}.`;

    await loginWithPhoneOtp(page, proof.client_phone);
    await completePinIfNeeded(page);
    await page.screenshot({ path: path.join(screenshotDir, 'live-client-after-login.png'), fullPage: true });

    await page.goto('/mobile/support');
    await expect(page.getByRole('heading', { name: /Support/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i)).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'live-client-support-before-upload.png'), fullPage: true });

    await page.locator('input[type="file"]').setInputFiles({
      name: 'justificatif-demo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(onePagePdf),
    });
    await expect(page.getByText('justificatif-demo.pdf').first()).toBeVisible();
    await page.getByPlaceholder(/Ajouter un message optionnel/i).fill(supportMessage);
    await page.getByRole('button', { name: /Envoyer le message/i }).click();
    await expect(page.getByText(supportMessage).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, 'live-client-support-upload-sent.png'), fullPage: true });

    await page.goto('/mobile/notifications');
    await expect(page.getByRole('heading', { name: /Notifications/i })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, 'live-client-notifications.png'), fullPage: true });

    await page.goto('/mobile/cards/atm-finder');
    await expect(page.getByRole('heading', { name: /DAB a proximite/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Catalogue hors ligne/i)).toBeVisible();
    await page.getByRole('button', { name: /Trier par proximite/i }).click();
    await expect(page.getByText(/DAB tries par proximite|Position indisponible/i)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, 'live-client-atm-finder.png'), fullPage: true });

    expect(badResponses).toEqual([]);
  });
});
