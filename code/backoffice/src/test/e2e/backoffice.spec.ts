import { test, expect } from '@playwright/test'

test.describe('Back-Office BICEC VeriPass', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/back-office/login')
  })

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bicec veripass/i })).toBeVisible()
    await expect(page.getByText(/connexion/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible()
  })

  test('should login as JEAN and access validation queue', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/file de validation/i)).toBeVisible({ timeout: 15000 })
  })

  test('should login as THOMAS and access compliance page', async ({ page }) => {
    await page.fill('input[type="email"]', 'thomas@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: /conformit/i })).toBeVisible()
  })

  test('should login as SYLVIE and access command center', async ({ page }) => {
    await page.fill('input[type="email"]', 'sylvie@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/command center/i)).toBeVisible({ timeout: 15000 })
  })

  test('should login as ADMIN_IT and access admin page', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: /administration/i })).toBeVisible()
  })

  test('should restrict access based on RBAC', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByRole('heading', { name: /file de validation/i })).toBeVisible({ timeout: 15000 })
    await page.goto('/back-office/compliance')
    await expect(page.getByRole('heading', { name: /acc/i })).toBeVisible()
  })
})
