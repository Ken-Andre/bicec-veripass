import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/mobile/screens');
const threadId = '11111111-1111-4111-8111-111111111111';
const onePagePdf = '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF';

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

async function clearBrowserState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function installAuthenticatedState(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('vp_token', 'evidence-token');
    localStorage.setItem('vp_user', JSON.stringify({
      id: 'evidence-user',
      phone: '+237699000000',
      email: 'marie.test@veripass.local',
      role: 'CLIENT',
      has_pin: true,
    }));
    localStorage.setItem('vp_push_subscription_id', 'push-sub-evidence');
    localStorage.setItem('vp_push_enabled', 'true');
    localStorage.setItem('vp_device_tag', 'vp_dev_evidence');
  });
}

async function mockAuthenticatedApis(page: Page) {
  await page.route('**/api/v1/kyc/session/current', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No active KYC session for evidence run' }),
    });
  });
  await page.route('**/api/v1/support/threads/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: threadId, status: 'OPEN' }),
    });
  });
  await page.route(`**/api/v1/support/threads/${threadId}/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'msg-agent-1',
          thread_id: threadId,
          sender: 'agent',
          content: 'Bonjour Marie, envoyez le justificatif complementaire ici.',
          created_at: '2026-05-22T07:30:00Z',
        },
        {
          id: 'msg-user-1',
          thread_id: threadId,
          sender: 'user',
          content: 'Bien recu, je vous le transmets.',
          created_at: '2026-05-22T07:31:00Z',
        },
      ]),
    });
  });
  await page.route(`**/api/v1/support/threads/${threadId}/attachments`, async (route) => {
    const body = route.request().postDataBuffer();
    expect(body?.toString('utf8')).toContain('justificatif.pdf');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg-user-attachment',
        thread_id: threadId,
        sender: 'user',
        content: 'Justificatif joint',
        attachment_filename: 'justificatif.pdf',
        attachment_sha256: 'evidence-sha256',
        attachment_path: '/data/documents/support/evidence/justificatif.pdf',
        created_at: '2026-05-22T07:33:00Z',
      }),
    });
  });
  await page.route('**/api/v1/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unread_count: 1,
        items: [
          {
            id: 'notif-info-requested',
            type: 'INFO_REQUESTED',
            title: 'Document complementaire requis',
            message: 'Le backoffice demande un justificatif supplementaire.',
            read: false,
            created_at: '2026-05-22T07:32:00Z',
          },
        ],
      }),
    });
  });
  await page.route('**/api/v1/notifications/preferences', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          official_channel: body.official_channel ?? 'sms',
          push_enabled: body.push_enabled ?? true,
          in_app_enabled: true,
          updated_at: '2026-05-22T14:30:00Z',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        official_channel: 'sms',
        push_enabled: true,
        in_app_enabled: true,
        updated_at: '2026-05-22T14:20:00Z',
      }),
    });
  });
  await page.route('**/api/v1/notifications/subscriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'push-sub-evidence',
          endpoint: 'https://push.example/evidence',
          device_tag: 'vp_dev_evidence',
          is_active: true,
          created_at: '2026-05-22T14:00:00Z',
        },
      ]),
    });
  });
  await page.route('**/api/v1/notifications/subscriptions/push-sub-evidence', async (route) => {
    await route.fulfill({ status: 204 });
  });
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

test.describe('Day 1 mobile evidence', () => {
  test.beforeEach(() => {
    ensureEvidenceDir();
  });

  test('auth choice and login route are explicit', async ({ page }) => {
    const badResponses = collectBadResponses(page);
    await clearBrowserState(page);

    await page.goto('/mobile/auth');
    await expect(page.getByRole('heading', { name: /BICEC VeriPass/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Se connecter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Creer un compte|Créer un compte/i })).toBeVisible();
    await screenshotEvidence(page, 'auth-choice.png');

    await page.getByRole('button', { name: /Se connecter/i }).click();
    await expect(page).toHaveURL(/\/mobile\/auth\/phone\?mode=login$/);
    await screenshotEvidence(page, 'login-route.png');

    expect(badResponses).toEqual([]);
  });

  test('unauthenticated protected route redirects to auth choice', async ({ page }) => {
    await clearBrowserState(page);

    await page.goto('/mobile/support');
    await expect(page).toHaveURL(/\/mobile\/auth$/);
    await expect(page.getByRole('button', { name: /Se connecter/i })).toBeVisible();
    await screenshotEvidence(page, 'protected-route-auth-redirect.png');
  });

  test('service worker update banner is visible and actionable', async ({ page }) => {
    await clearBrowserState(page);

    await page.goto('/mobile/auth');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('vp:service-worker-update-available'));
    });
    await expect(page.getByText(/Nouvelle version disponible/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Recharger/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Plus tard/i })).toBeVisible();
    await screenshotEvidence(page, 'service-worker-update-banner.png');
  });

  test('support and notifications screens render without 5xx responses', async ({ page }) => {
    const badResponses = collectBadResponses(page);
    await installAuthenticatedState(page);
    await mockAuthenticatedApis(page);

    await page.goto('/mobile/support');
    await expect(page.getByText(/justificatif complementaire/i)).toBeVisible();
    await expect(page.getByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i)).toBeVisible();
    await expect(page.getByText(/0\/4000/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Tapez votre message/i)).toBeEnabled();
    await screenshotEvidence(page, 'support-screen.png');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'justificatif.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(onePagePdf),
    });
    await expect(page.getByText('justificatif.pdf')).toBeVisible();
    await expect(page.getByPlaceholder(/Ajouter un message optionnel/i)).toBeVisible();
    await screenshotEvidence(page, 'support-attachment-selected.png');

    await page.getByPlaceholder(/Ajouter un message optionnel/i).fill('Justificatif joint');
    await page.getByRole('button', { name: /Envoyer le message/i }).click();
    await expect(page.getByText(/evidence-sha256|Justificatif joint|justificatif.pdf/i).first()).toBeVisible();
    await screenshotEvidence(page, 'support-attachment-sent.png');

    await page.goto('/mobile/notifications');
    await expect(page.getByText(/Document complementaire requis/i)).toBeVisible();
    await screenshotEvidence(page, 'notifications-screen.png');

    await page.goto('/mobile/settings');
    await expect(page.getByText(/Messages officiels/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'SMS' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email' })).toBeVisible();
    await screenshotEvidence(page, 'settings-official-channel.png');
    await page.getByRole('button', { name: 'Email' }).click();
    await screenshotEvidence(page, 'settings-official-channel-email.png');
    await page.getByRole('button', { name: 'Notifications push' }).click();
    await page.waitForFunction(() => localStorage.getItem('vp_push_enabled') === null);
    await expect(page.getByRole('button', { name: 'Notifications push' })).toHaveClass(/bg-muted/);
    await screenshotEvidence(page, 'settings-push-disabled.png');

    expect(badResponses).toEqual([]);
  });
});
