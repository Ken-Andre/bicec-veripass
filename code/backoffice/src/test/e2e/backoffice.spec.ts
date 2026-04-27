import { test, expect } from '@playwright/test'

test.describe('Back-Office BICEC VeriPass', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001')
  })

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible()
  })

  test('should login as JEAN and access validation queue', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/file de validation/i)).toBeVisible()
  })

  test('should login as THOMAS and access compliance page', async ({ page }) => {
    await page.fill('input[type="email"]', 'thomas@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/conformité aml/i)).toBeVisible()
  })

  test('should login as SYLVIE and access command center', async ({ page }) => {
    await page.fill('input[type="email"]', 'sylvie@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/command center/i)).toBeVisible()
  })

  test('should login as ADMIN_IT and access admin page', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/administration/i)).toBeVisible()
  })

  test('should restrict access based on RBAC', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    await page.goto('http://localhost:3001/compliance')
    await expect(page.getByText(/accès refusé/i)).toBeVisible()
  })
})
