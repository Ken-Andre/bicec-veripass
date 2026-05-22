import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

declare global {
  interface Window {
    injectCniImage?: (base64: string) => void;
  }
}

test.describe('Onboarding Flow', () => {
  const phoneNumber = '69' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const pin = '111111';
  const mailpitUrl = 'http://127.0.0.1:8025/api/v1/messages';

  // Paths to synthetic images (resolved from project root where test is run)
  const rectoPath = path.resolve(process.cwd(), '../../paddleocr_test/notebooks/output/pdf_pages/trybeg/6.png');
  const versoPath = path.resolve(process.cwd(), '../../paddleocr_test/notebooks/output/pdf_pages/trybeg/3.png');

  async function deleteMailpitMessages() {
    try {
      await fetch(mailpitUrl, { method: 'DELETE' });
      console.log('Cleared Mailpit messages.');
    } catch (e) {
      console.error('Failed to clear Mailpit messages:', e.message);
    }
  }

  async function getLatestOTP(retries = 10) {
    console.log(`Attempting to retrieve OTP from Mailpit (retries left: ${retries})...`);
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(mailpitUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`Mailpit API returned ${response.status}`);
        
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const latestMessage = data.messages[0];
          const snippetKey = Object.keys(latestMessage).find((k) => k.toLowerCase() === 'snippet');
          const snippet = snippetKey ? latestMessage[snippetKey] : undefined;
          
          if (!snippet) {
             console.log('Message found but no snippet-like property available:', JSON.stringify(latestMessage));
          } else {
            const otpMatch = snippet.match(/\d{6}/);
            if (otpMatch) {
              console.log(`OTP found: ${otpMatch[0]}`);
              return otpMatch[0];
            } else {
              console.log(`Snippet found but no 6-digit code in: "${snippet}"`);
            }
          }
        } else {
          console.log('Mailpit returned no messages yet.');
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error('Mailpit fetch timed out');
        } else {
          console.error(`Error fetching OTP: ${error.message}`);
        }
        try {
          const debugResponse = await fetch(mailpitUrl);
          const debugBody = await debugResponse.text();
          console.error('Mailpit raw response for debugging:', debugBody);
        } catch (debugError) {
          console.error(`Unable to fetch Mailpit raw response: ${debugError.message}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
      
      console.log(`OTP not found yet, waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('OTP not found in Mailpit after multiple attempts');
  }

  test.beforeEach(async ({ page }) => {
    await deleteMailpitMessages();
    // Mock getUserMedia to inject synthetic images
    await page.addInitScript(() => {
      let mockStream: MediaStream | null = null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      window.injectCniImage = (base64: string) => {
        img.src = base64;
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          if (!mockStream) {
            mockStream = canvas.captureStream(10);
          }
        };
      };

      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (constraints?.video) {
          // Wait for image to be injected if not already there
          while (!mockStream) {
            await new Promise(r => setTimeout(r, 100));
          }
          return mockStream;
        }
        return originalGetUserMedia(constraints);
      };
    });
  });

  test('should complete onboarding with camera capture automation', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout to 60s for OTP retrieval
    // 1. Navigate to landing page
    await page.goto('/');
    
    // 2. Click "Get Started"
    const getStartedBtn = page.getByRole('button', { name: /Ouvrir mon compte/i });
    await expect(getStartedBtn).toBeVisible();
    await getStartedBtn.click();

    // 3. Enter Phone Number
    const phoneInput = page.getByPlaceholder('6XX XXX XXX');
    await phoneInput.fill(phoneNumber);
    
    const sendCodeBtn = page.getByRole('button', { name: /Envoyer le code/i });
    await sendCodeBtn.click();

    // 4. Enter OTP
    const otp = await getLatestOTP();
    const otpInputs = page.locator('input[class*="w-full max-w-[50px]"]');
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otp[i]);
    }

    const validateBtn = page.getByRole('button', { name: /Valider le compte/i });
    await validateBtn.click();

    // 4.1 Handle optional Email Association screen (new redirect in flow)
    const skipEmailBtn = page.getByRole('button', { name: /Passer cette étape/i });
    const emailInput = page.getByPlaceholder('votre@email.com');
    const verifyEmailBtn = page.getByRole('button', { name: /Vérifier par email/i });

    if (await skipEmailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('EmailEntryScreen detected. Skipping email association step.');
      await skipEmailBtn.click();
    } else if (await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('EmailEntryScreen detected via input. Filling test email and continuing.');
      const testEmail = `e2e.${phoneNumber}@veripass.local`;
      await emailInput.fill(testEmail);
      await verifyEmailBtn.click();
      // We intentionally do not fetch email OTP here; prefer skip path when available.
      // If this branch is used, flow may continue depending on backend policy.
    }

    // 5. Enter PIN (Keypad)
    for (const digit of pin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }

    // 6. Fill Profile
    await page.getByPlaceholder(/Ex: Marie Claire/i).fill('John');
    await page.getByPlaceholder(/Ex: Nguemo/i).fill('Doe');
    await page.getByRole('button', { name: /Continuer/i }).click();

    // 7. Document Choice
    await page.getByRole('button', { name: /Carte Nationale d Identite/i }).click();
    await page.getByRole('button', { name: /Continuer vers la capture CNI/i }).click();

    // 8. Recto Capture
    await expect(page.getByText(/Recto de la CNI/i)).toBeVisible();
    
    // Inject Recto Image
    const rectoBase64 = fs.readFileSync(rectoPath, { encoding: 'base64' });
    await page.evaluate((b64) => window.injectCniImage?.(`data:image/png;base64,${b64}`), rectoBase64);
    
    await page.getByRole('button', { name: /Ouvrir la caméra/i }).click();
    
    // Wait for "Quality Good" and capture
    await page.getByRole('button', { name: /Capturer/i }).click();
    await page.getByRole('button', { name: /Confirmer/i }).click();

    // 9. Verso Capture
    await expect(page.getByText(/Verso de la CNI/i)).toBeVisible();
    
    // Inject Verso Image
    const versoBase64 = fs.readFileSync(versoPath, { encoding: 'base64' });
    await page.evaluate((b64) => window.injectCniImage?.(`data:image/png;base64,${b64}`), versoBase64);
    
    await page.getByRole('button', { name: /Ouvrir la caméra/i }).click();
    
    // Wait for "Quality Good" and capture
    await page.getByRole('button', { name: /Capturer/i }).click();
    await page.getByRole('button', { name: /Confirmer/i }).click();

    // 10. Wait for OCR Processing and Review
    await expect(page.getByText(/Vérification de vos informations/i)).toBeVisible({ timeout: 30000 });
    
    // Proceed from OCR Review
    const confirmOcrBtn = page.getByRole('button', { name: /Confirmer les informations/i });
    await expect(confirmOcrBtn).toBeVisible({ timeout: 60000 });
    await confirmOcrBtn.click();

    console.log('Successfully completed CNI capture and OCR review.');
  });
});
