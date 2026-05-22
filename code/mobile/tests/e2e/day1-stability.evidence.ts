import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = path.resolve(process.cwd(), '../../docs/test-evidence/latest/mobile/screens');
const threadId = '11111111-1111-4111-8111-111111111111';

function ensureEvidenceDir() {
  fs.mkdirSync(screenshotDir, { recursive: true });
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
    await page.screenshot({ path: path.join(screenshotDir, 'auth-choice.png'), fullPage: true });

    await page.getByRole('button', { name: /Se connecter/i }).click();
    await expect(page).toHaveURL(/\/mobile\/auth\/phone\?mode=login$/);
    await page.screenshot({ path: path.join(screenshotDir, 'login-route.png'), fullPage: true });

    expect(badResponses).toEqual([]);
  });

  test('unauthenticated protected route redirects to auth choice', async ({ page }) => {
    await clearBrowserState(page);

    await page.goto('/mobile/support');
    await expect(page).toHaveURL(/\/mobile\/auth$/);
    await expect(page.getByRole('button', { name: /Se connecter/i })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'protected-route-auth-redirect.png'), fullPage: true });
  });

  test('support and notifications screens render without 5xx responses', async ({ page }) => {
    const badResponses = collectBadResponses(page);
    await installAuthenticatedState(page);
    await mockAuthenticatedApis(page);

    await page.goto('/mobile/support');
    await expect(page.getByText(/justificatif complementaire/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Tapez votre message/i)).toBeEnabled();
    await page.screenshot({ path: path.join(screenshotDir, 'support-screen.png'), fullPage: true });

    await page.goto('/mobile/notifications');
    await expect(page.getByText(/Document complementaire requis/i)).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDir, 'notifications-screen.png'), fullPage: true });

    expect(badResponses).toEqual([]);
  });
});
