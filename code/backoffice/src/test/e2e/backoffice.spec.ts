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

  test('should login as JEAN and access validation desk', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText(/bureau de validation/i)).toBeVisible()
    await expect(page.getByText(/marie ngono/i)).toBeVisible()
  })

  test('should login as THOMAS and access compliance page', async ({ page }) => {
    await page.fill('input[type="email"]', 'thomas@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText(/conformité aml/i)).toBeVisible()
    await expect(page.getByText(/alertes pep/i)).toBeVisible()
  })

  test('should login as SYLVIE and access command center', async ({ page }) => {
    await page.fill('input[type="email"]', 'sylvie@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText(/command center/i)).toBeVisible()
    await expect(page.getByText(/violations sla/i)).toBeVisible()
  })

  test('should login as ADMIN_IT and access admin page', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page.getByText(/administration/i)).toBeVisible()
    await expect(page.getByText(/gestion des agents/i)).toBeVisible()
  })

  test('should restrict access based on RBAC', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.goto('http://localhost:3001/compliance')
    await expect(page.getByText(/accès refusé/i)).toBeVisible()
  })

  test('should validate KYC dossier', async ({ page }) => {
    await page.fill('input[type="email"]', 'jean@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.click('text=Marie Ngono')
    await expect(page.getByText(/détails du dossier/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /approuver/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /rejeter/i })).toBeVisible()
  })

  test('should screen AML alerts', async ({ page }) => {
    await page.fill('input[type="email"]', 'thomas@bicec.cm')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await page.click('text=Alhadji Moussa')
    await expect(page.getByText(/score de correspondance/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /faux positif/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /confirmer match/i })).toBeVisible()
  })
})