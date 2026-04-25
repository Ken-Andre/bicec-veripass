/**
 * Vitest global setup for jsdom environment.
 * Provides stubs for APIs that jsdom does not implement.
 */
import { vi } from 'vitest'
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// Stub crypto.subtle for AES-GCM (used by kycOfflineStore encryption)
const subtleStub = {
  importKey: vi.fn().mockResolvedValue({}),
  encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
  decrypt: vi.fn().mockImplementation(async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data),
};

// jsdom in modern Node (18+) provides crypto.subtle natively, so we no longer
// need the AES-GCM stub. Keep the subtleStub definition as a fallback only.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: subtleStub,
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      randomUUID: () => `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
    },
    writable: true,
  });
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', { value: subtleStub, writable: true });
}

// Stub TextEncoder / TextDecoder (jsdom provides these but just in case)
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = await import('util');
  globalThis.TextEncoder = TextEncoder as any;
  globalThis.TextDecoder = TextDecoder as any;
}
