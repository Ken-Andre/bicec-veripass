import { test, expect, type Page } from '@playwright/test'

async function triggerSessionWarning(page: Page) {
  await page.route('**/api/v1/auth/refresh', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"refresh expired"}' })
  )
  await page.route('**/api/v1/backoffice/force-warning', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"access expired"}' })
  )
  await page.evaluate(() => fetch('/api/v1/backoffice/force-warning'))
}

async function openAdminWithStoredSession(page: Page) {
  await page.goto('/back-office/login')
  await page.evaluate(() => {
    localStorage.setItem('veripass_access_token', 'e2e-access-token')
    localStorage.setItem('veripass_refresh_token', 'e2e-refresh-token')
    localStorage.setItem('veripass_token_expires_at', String(Date.now() + 5 * 60 * 1000))
    localStorage.setItem('veripass_user', JSON.stringify({
      id: 'admin-it-e2e',
      email: 'admin@bicec.cm',
      name: 'Admin IT',
      role: 'ADMIN_IT',
    }))
  })
  await page.goto('/back-office/admin')
  await expect(page.getByRole('heading', { name: /administration/i })).toBeVisible()
}

test.describe('Back-Office Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/back-office/login')
  })

  test('should display login page with all elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bicec veripass/i })).toBeVisible()
    await expect(page.getByText(/connexion/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
  })

  test('should show error toast on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@bicec.cm')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/email ou mot de passe incorrect|invalid|account locked|verrou/i)).toBeVisible({ timeout: 5000 })
  })

  test('should navigate to profile page after login', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: /file de validation/i })).toBeVisible()

    await page.getByLabel(/profil/i).click()
    await expect(page.getByRole('heading', { name: /mon profil/i })).toBeVisible()
  })

  test('should access admin page with admin role', async ({ page }) => {
    await openAdminWithStoredSession(page)
    await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible()
  })

  test('should show session warning before expiry', async ({ page }) => {
    await openAdminWithStoredSession(page)
    await triggerSessionWarning(page)

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })
  })

  test('should dismiss session warning', async ({ page }) => {
    await openAdminWithStoredSession(page)
    await triggerSessionWarning(page)

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })

    await page.getByLabel(/masquer/i).click()
    await expect(page.getByText(/session sur le point d'expirer/i)).not.toBeVisible()
  })

  test('should logout from session warning banner', async ({ page }) => {
    await openAdminWithStoredSession(page)
    await triggerSessionWarning(page)

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /connexion/i }).first().click()
    await expect(page.getByRole('heading', { name: /bicec veripass/i })).toBeVisible()
  })
})
