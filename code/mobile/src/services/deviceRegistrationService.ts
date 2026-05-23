import { apiClient } from './apiClient';

interface DeviceRegistrationResponse {
  device_tag: string;
}

const DEVICE_SEED_KEY = 'vp_device_seed';
const DEVICE_TAG_KEY = 'vp_device_tag';

function randomHex(bytes = 16): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function getOrCreateDeviceSeed(): string {
  const existing = localStorage.getItem(DEVICE_SEED_KEY);
  if (existing) return existing;
  const seed = randomHex(24);
  localStorage.setItem(DEVICE_SEED_KEY, seed);
  return seed;
}

export function getDeviceMetadata() {
  return {
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    languages: navigator.languages?.slice(0, 4) ?? [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    screen: {
      width: window.screen?.width ?? 0,
      height: window.screen?.height ?? 0,
      colorDepth: window.screen?.colorDepth ?? 0,
      pixelRatio: window.devicePixelRatio || 1,
    },
  };
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildDeviceFingerprintHash(): Promise<string> {
  const metadata = getDeviceMetadata();
  return sha256Hex(JSON.stringify({ seed: getOrCreateDeviceSeed(), metadata }));
}

export async function ensureDeviceRegistered(): Promise<string | null> {
  if (!crypto?.subtle || !navigator) return localStorage.getItem(DEVICE_TAG_KEY);

  const fingerprintHash = await buildDeviceFingerprintHash();
  const response = await apiClient.post<DeviceRegistrationResponse, { fingerprint_hash: string; metadata: ReturnType<typeof getDeviceMetadata> }>(
    '/devices/register',
    {
      fingerprint_hash: fingerprintHash,
      metadata: getDeviceMetadata(),
    },
    {
      headers: {
        'X-Device-Fingerprint': fingerprintHash,
      },
    },
  );

  localStorage.setItem(DEVICE_TAG_KEY, response.device_tag);
  return response.device_tag;
}
