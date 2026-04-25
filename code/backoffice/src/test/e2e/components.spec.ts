import { test, expect } from '@playwright/test'

test.describe('Back-Office Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/login')
  })

  test('should display login page with all elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
  })

  test('should show error toast on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@bicec.cm')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/identifiants invalides/i)).toBeVisible({ timeout: 5000 })
  })

  test('should navigate to profile page after login', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/bureau de validation/i)).toBeVisible()

    await page.click('[aria-label="Profil"]')
    await expect(page.getByText(/mon profil/i)).toBeVisible()
  })

  test('should access admin page with admin role', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/administration/i)).toBeVisible()
    await expect(page.getByText(/gestion des agents/i)).toBeVisible()
  })

  test('should show session warning before expiry', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/bureau de validation/i)).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('token_expires_at', String(Date.now() + 2 * 60 * 1000))
      window.dispatchEvent(new Event('storage'))
    })

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })
  })

  test('should dismiss session warning', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/bureau de validation/i)).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('token_expires_at', String(Date.now() + 2 * 60 * 1000))
      window.dispatchEvent(new Event('storage'))
    })

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })

    await page.click('button[aria-label="Masquer"]')
    await expect(page.getByText(/session sur le point d'expirer/i)).not.toBeVisible()
  })

  test('should logout from session warning banner', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/bureau de validation/i)).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('token_expires_at', String(Date.now() + 2 * 60 * 1000))
      window.dispatchEvent(new Event('storage'))
    })

    await expect(page.getByText(/session sur le point d'expirer/i)).toBeVisible({ timeout: 10000 })

    await page.click('text=Déconnexion')
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible()
  })
})
