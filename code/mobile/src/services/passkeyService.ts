// WebAuthn Passkey Service
// Uses the Web Authentication API for biometric authentication (fingerprint, Face ID, Windows Hello)

const RP_ID = window.location.hostname;
const RP_NAME = 'BICEC VeriPass';

export function isPasskeySupported(): boolean {
  return !!window.PublicKeyCredential;
}

function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge.buffer as ArrayBuffer;
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export async function registerPasskey(userId: string): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: generateChallenge(),
        rp: { name: RP_NAME, id: RP_ID },
        user: {
          id: new TextEncoder().encode(userId).buffer as ArrayBuffer,
          name: `user-${userId}`,
          displayName: 'BICEC User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // Store credential ID for future authentication
    localStorage.setItem('vp_passkey_cred', base64urlEncode(credential.rawId));
    localStorage.setItem('vp_biometric', 'true');
    return true;
  } catch {
    console.warn('Passkey registration cancelled or failed');
    return false;
  }
}

export async function authenticatePasskey(): Promise<boolean> {
  if (!isPasskeySupported()) return false;

  const credId = localStorage.getItem('vp_passkey_cred');
  if (!credId) return false;

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: generateChallenge(),
        rpId: RP_ID,
        allowCredentials: [
          {
            id: base64urlDecode(credId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch {
    console.warn('Passkey authentication cancelled or failed');
    return false;
  }
}

export function removePasskey(): void {
  localStorage.removeItem('vp_passkey_cred');
  localStorage.removeItem('vp_biometric');
}
