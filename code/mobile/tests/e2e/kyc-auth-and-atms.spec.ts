import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Client KYC, Secure Auth & Offline ATMs E2E Journeys (ATDD)', () => {
  const phoneNumber = '69' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const pin = '111111';

  // Paths to CNI images for OCR simulation
  const rectoPath = path.resolve(process.cwd(), '../../paddleocr_test/notebooks/output/pdf_pages/trybeg/6.png');
  const versoPath = path.resolve(process.cwd(), '../../paddleocr_test/notebooks/output/pdf_pages/trybeg/3.png');

  test.beforeEach(async ({ page }) => {
    // Basic test setup or local database simulation
    await page.addInitScript(() => {
      // Setup mock biometrics and local db indicators
      Object.defineProperty(navigator, 'credentials', {
        value: {
          create: async () => ({ id: 'passkey-credential-id', rawId: new Uint8Array(), type: 'public-key' }),
          get: async () => ({ id: 'passkey-credential-id', rawId: new Uint8Array(), type: 'public-key' })
        }
      });
    });
  });

  // ==========================================
  // 1. SESSION MANAGEMENT & NAVIGATION
  // ==========================================

  test.skip('[P0] should resume session where user left off or allow restarting', async ({ page }) => {
    // Given returning user navigating back to the app
    await page.goto('/');

    // When the app detects an incomplete session
    const resumePrompt = page.getByText(/Reprendre l'onboarding là où vous vous étiez arrêté/i);
    await expect(resumePrompt).toBeVisible();

    // Then user should be able to either continue or start over
    const continueBtn = page.getByRole('button', { name: /Continuer la session/i });
    const restartBtn = page.getByRole('button', { name: /Recommencer au début/i });
    await expect(continueBtn).toBeVisible();
    await expect(restartBtn).toBeVisible();

    await continueBtn.click();
    // User lands back on the exact last step, e.g., CNI upload page
    await expect(page.getByText(/Recto de la CNI/i)).toBeVisible();
  });

  test.skip('[P0] should allow pre-submission back navigation to edit previous steps', async ({ page }) => {
    // Given user is on the final summary page before submission
    await page.goto('/onboarding/summary');
    await expect(page.getByText(/Vérifiez vos informations/i)).toBeVisible();

    // When user wants to change their personal details
    const editPersonalDetailsBtn = page.getByRole('link', { name: /Modifier l'identité/i });
    await editPersonalDetailsBtn.click();

    // Then user is navigated back to the identity form step
    await expect(page.waitForURL('**/onboarding/profile'));
    const prefilledName = page.getByPlaceholder(/Ex: Marie Claire/i);
    await expect(prefilledName).toHaveValue('John');
    
    // User can edit and return to summary
    await prefilledName.fill('Johnny');
    await page.getByRole('button', { name: /Continuer/i }).click();
    await page.waitForURL('**/onboarding/summary');
  });

  // ==========================================
  // 2. CNI UPLOAD, OCR REVIEW & AUTHENTICITY CHECKS
  // ==========================================

  test.skip('[P0] should process CNI and strictly validate SP and Post fields during OCR review', async ({ page }) => {
    await page.goto('/onboarding/cni-upload');

    // When Recto and Verso are captured
    await page.getByRole('button', { name: /Importer Recto/i }).click();
    await page.getByRole('button', { name: /Importer Verso/i }).click();

    // Then user is shown OCR extraction review page
    await page.waitForURL('**/onboarding/ocr-review');
    await expect(page.getByText(/Vérification des informations lues/i)).toBeVisible();

    const spInput = page.getByLabel(/Numéro S.P./i);
    const postInput = page.getByLabel(/Poste d'identification/i);

    // Strict Cameroon CNI format checks: S.P. is 6 digits, Post is 2 letters + 2 digits (e.g. SW09)
    await spInput.fill('600000');
    await postInput.fill('SW09');

    const saveAndSubmitBtn = page.getByRole('button', { name: /Confirmer les informations/i });
    await expect(saveAndSubmitBtn).toBeEnabled();

    // Trigger validation error on invalid SP (containing letters)
    await spInput.fill('60000A');
    await expect(page.getByText(/Le numéro S.P. doit comporter exactement 6 chiffres/i)).toBeVisible();
  });

  test.skip('[P1] should perform background authenticity check during live capture', async ({ page }) => {
    await page.goto('/onboarding/cni-capture');
    
    // During live camera capture, system performs background validations (integrity, anti-tamper)
    const backgroundCheckIndicator = page.getByTestId('document-authenticity-status');
    await expect(backgroundCheckIndicator).toHaveText(/Vérification en cours en arrière-plan/i);

    // Let the live background verify complete
    await expect(backgroundCheckIndicator).toHaveText(/Analyse d'authenticité effectuée/i);
  });

  // ==========================================
  // 3. LIVENESS CHECK & TEST MODE BYPASS
  // ==========================================

  test.skip('[P1] should execute liveness check and support automated IA bypass', async ({ page }) => {
    await page.goto('/onboarding/liveness');
    await expect(page.getByText(/Vérification de présence physique/i)).toBeVisible();

    // Active test bypass is checked to let automated test runners pass the face-capture stage
    const bypassOption = page.locator('[data-testid="test-liveness-bypass"]');
    if (await bypassOption.isVisible()) {
      await bypassOption.check();
    }

    await page.getByRole('button', { name: /Démarrer la capture liveness/i }).click();
    await expect(page.getByText(/Liveness validé/i)).toBeVisible();
  });

  // ==========================================
  // 4. DOSSIER SUBMISSION & CHAT SUPPORT INTERACTION
  // ==========================================

  test.skip('[P0] should submit dossier and receive push notifications for Backoffice requests', async ({ page }) => {
    await page.goto('/onboarding/summary');
    
    // Authorize push notifications
    const notifyAuthBtn = page.getByRole('button', { name: /Autoriser les notifications/i });
    await expect(notifyAuthBtn).toBeVisible();
    await notifyAuthBtn.click();

    // Submit the dossier
    await page.getByRole('button', { name: /Soumettre mon dossier/i }).click();
    await expect(page.getByText(/Dossier soumis avec succès/i)).toBeVisible();
    await expect(page.locator('[data-testid="dossier-status"]')).toHaveText(/En cours d'examen/i);

    // Simulate Backoffice requesting complementary file -> triggers push alert
    const pushNotification = page.locator('[data-testid="app-push-banner"]');
    await expect(pushNotification).toBeVisible();
    await expect(pushNotification).toContainText(/Action requise: document complémentaire demandé/i);

    // Click notification to open support chat
    await pushNotification.click();
    await expect(page.waitForURL('**/support-chat'));
    await expect(page.getByText(/Veuillez nous transmettre votre justificatif de domicile/i)).toBeVisible();

    // Verify Chat file upload size limit anchor (strict limit visual indicator)
    const fileLimitText = page.locator('[data-testid="chat-upload-size-limit"]');
    await expect(fileLimitText).toContainText(/Taille maximale : 5 Mo/i);

    // Attempt to upload over-limit file (e.g. 10MB)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('chat-attach-file-btn').click();
    const fileChooser = await fileChooserPromise;
    // Inject custom mock large file
    await fileChooser.setFiles([{
      name: 'large_invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024 * 1024 * 10) // 10MB
    }]);

    await expect(page.getByText(/Le fichier dépasse la limite autorisée de 5 Mo/i)).toBeVisible();

    // Success path upload valid file (e.g. 2MB)
    await page.getByTestId('chat-attach-file-btn').click();
    const fileChooserValid = await page.waitForEvent('filechooser');
    await fileChooserValid.setFiles([{
      name: 'valid_invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024 * 1024 * 2) // 2MB
    }]);

    await page.getByRole('button', { name: /Envoyer/i }).click();
    await expect(page.getByText(/Fichier envoyé/i)).toBeVisible();

    // Simulate Backoffice validating the dossier
    await expect(page.locator('[data-testid="dossier-status"]')).toHaveText(/Validé/i);
    await expect(page.getByText(/Félicitations! Votre compte est activé/i)).toBeVisible();
  });

  // ==========================================
  // 5. SECURITY, AUTHENTICATION & LOCK SCREEN FIXED FLOWS
  // ==========================================

  test.skip('[P0] should navigate post-auth without redirection loops and avoid stuck lock screen', async ({ page }) => {
    // Given returning user enters their correct PIN
    await page.goto('/unlock');
    await expect(page.getByText(/Saisissez votre code PIN/i)).toBeVisible();

    // Enter 6 correct digits
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: '1', exact: true }).click();
    }

    // Verify the user is NOT stuck on the lock screen with 6 dots filled, but instantly redirected to Dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.getByText(/Solde disponible/i)).toBeVisible();

    // Clicking back button should NEVER return to unlock screen or stale pre-auth screens
    await page.goBack();
    // Assert still on dashboard or proper error screen, not lock screen
    await expect(page.url()).not.toContain('/unlock');
  });

  test.skip('[P0] should lock the app on exit or inactivity', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Solde disponible/i)).toBeVisible();

    // Simulate app going to background (exit / sleep)
    await page.dispatchEvent(document, 'visibilitychange', { bubbles: true, cancelable: true });
    
    // Return to the app
    await page.dispatchEvent(document, 'visibilitychange', { bubbles: true, cancelable: true });

    // Assert app locked and lock screen shown
    await expect(page.waitForURL('**/unlock'));
    await expect(page.getByText(/Saisissez votre code PIN/i)).toBeVisible();
  });

  test.skip('[P1] should allow biometrics and passkey toggles in settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Paramètres/i }).click();
    await page.waitForURL('**/settings');

    const toggleBiometricLogin = page.locator('[data-testid="toggle-biometric-login"]');
    const toggleBiometricPasscode = page.locator('[data-testid="toggle-biometric-passcode"]');

    // Toggle biometrics on
    await toggleBiometricLogin.check();
    await expect(toggleBiometricLogin).toBeChecked();

    await toggleBiometricPasscode.check();
    await expect(toggleBiometricPasscode).toBeChecked();

    // Passcode reset option
    const resetPasscodeBtn = page.getByRole('button', { name: /Réinitialiser mon code secret/i });
    await resetPasscodeBtn.click();
    await expect(page.waitForURL('**/settings/reset-passcode'));
    await expect(page.getByText(/Code de réinitialisation envoyé/i)).toBeVisible();
  });

  // ==========================================
  // 6. OFFLINE ATMs & DAB SEARCH
  // ==========================================

  test.skip('[P2] should fetch offline ATMs based on onboarding status', async ({ page }) => {
    // When offline and user is NOT fully validated (pre-submission)
    await page.goto('/atm-finder');
    await expect(page.getByText(/Distributeurs Automatiques (DAB)/i)).toBeVisible();

    const atmList = page.locator('[data-testid="atm-item"]');
    // Pre-onboarding provides a basic list of core ATMs
    await expect(atmList).toHaveCount(3);

    // Given validated user (dossier submitted & validated)
    // Simulate user state upgrade
    await page.goto('/onboarding/summary');
    await page.getByRole('button', { name: /Soumettre mon dossier/i }).click();

    // Navigate to ATM finder
    await page.goto('/atm-finder');
    // Full directory is now unlocked
    await expect(atmList).toHaveCount(15);

    // Verify map link opening coordinate payload
    const mapLink = atmList.first().getByRole('link', { name: /Ouvrir dans Maps/i });
    await expect(mapLink).toHaveAttribute('href', /https:\/\/maps\.google\.com\/\?q=/);
  });
});
