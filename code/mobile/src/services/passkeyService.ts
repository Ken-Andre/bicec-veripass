// WebAuthn Passkey Service
// Uses the Web Authentication API for biometric authentication (fingerprint, Face ID, Windows Hello)

import { apiClient } from './apiClient';

const RP_ID = window.location.hostname;
const RP_NAME = 'BICEC VeriPass';

export function isPasskeySupported(): boolean {
  return !!window.PublicKeyCredential;
}

export interface PasskeyAuthResult {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  session_handle?: string | null;
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
    const options = await apiClient.post<{
      challenge: string;
      rp_id: string;
      rp_name: string;
      user_id: string;
      user_name: string;
      timeout: number;
    }, Record<string, never>>('/auth/webauthn/register/options', {});

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: base64urlDecode(options.challenge),
        rp: { name: options.rp_name || RP_NAME, id: options.rp_id || RP_ID },
        user: {
          id: new TextEncoder().encode(options.user_id || userId).buffer as ArrayBuffer,
          name: options.user_name || `user-${userId}`,
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
        timeout: options.timeout || 60000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    const credentialId = base64urlEncode(credential.rawId);
    await apiClient.post('/auth/webauthn/register/verify', {
      challenge: options.challenge,
      credential_id: credentialId,
      transports: ['internal'],
    });

    localStorage.setItem('vp_passkey_cred', credentialId);
    localStorage.setItem('vp_biometric', 'true');
    return true;
  } catch {
    console.warn('Passkey registration cancelled or failed');
    return false;
  }
}

export async function authenticatePasskey(phone?: string): Promise<PasskeyAuthResult | null> {
  if (!isPasskeySupported()) return null;
  if (!phone) return null;

  try {
    const options = await apiClient.post<{
      challenge: string;
      rp_id: string;
      allow_credentials: string[];
      timeout: number;
    }, { phone: string }>('/auth/webauthn/auth/options', { phone });

    const allowedCredentialIds = options.allow_credentials.length > 0
      ? options.allow_credentials
      : [localStorage.getItem('vp_passkey_cred')].filter(Boolean) as string[];

    if (allowedCredentialIds.length === 0) return null;

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: base64urlDecode(options.challenge),
        rpId: options.rp_id || RP_ID,
        allowCredentials: allowedCredentialIds.map((id) => ({
          id: base64urlDecode(id),
          type: 'public-key',
          transports: ['internal'],
        })),
        userVerification: 'required',
        timeout: options.timeout || 60000,
      },
    }) as PublicKeyCredential | null;

    if (!assertion) return null;

    const credentialId = base64urlEncode(assertion.rawId);
    localStorage.setItem('vp_passkey_cred', credentialId);
    return apiClient.post<PasskeyAuthResult, { phone: string; challenge: string; credential_id: string }>(
      '/auth/webauthn/auth/verify',
      {
        phone,
        challenge: options.challenge,
        credential_id: credentialId,
      },
    );
  } catch {
    console.warn('Passkey authentication cancelled or failed');
    return null;
  }
}

export function removePasskey(): void {
  localStorage.removeItem('vp_passkey_cred');
  localStorage.removeItem('vp_biometric');
}
