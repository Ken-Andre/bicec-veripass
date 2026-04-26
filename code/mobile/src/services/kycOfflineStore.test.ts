/**
 * Unit tests for kycOfflineStore — IndexedDB-backed offline storage.
 *
 * Uses fake-indexeddb (loaded in setup.ts) to simulate IndexedDB in jsdom.
 * Crypto.subtle is natively available in Node 18+ jsdom, so we get real
 * AES-GCM encryption/decryption round-trips.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  encryptJsonPayload,
  decryptJsonPayload,
  loadPersistedKycState,
  persistKycState,
  loadKycSyncQueue,
  persistKycSyncQueue,
  enqueueKycSyncItem,
  updateKycSyncItem,
  removeKycSyncItem,
  clearPersistedKycState,
  type PersistedKycState,
  type KycSyncQueueItem,
} from './kycOfflineStore';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeKycState(overrides: Partial<PersistedKycState> = {}): PersistedKycState {
  return {
    sessionId: 'sess-1',
    status: 'DRAFT',
    currentStep: 'address',
    completedSteps: ['cni_recto', 'cni_verso', 'ocr_review', 'liveness'],
    accessLevel: 'RESTRICTED',
    cniRectoCapture: null,
    cniVersoCapture: null,
    ocrFields: [],
    livenessAttempts: 0,
    address: null,
    billCapture: null,
    niuCapture: null,
    niuManual: null,
    consentCgu: false,
    consentPrivacy: false,
    consentData: false,
    signatureData: null,
    selectedPlan: null,
    interests: [],
    basicProfile: null,
    documentChoice: null,
    biometricConsentAccepted: false,
    ...overrides,
  };
}

// ── Test suites ───────────────────────────────────────────────────────────

// Clear IndexedDB between tests to avoid cross-test contamination
beforeEach(async () => {
  await clearPersistedKycState();
});

afterEach(async () => {
  await clearPersistedKycState();
});

// =========================================================================
// 1. Encryption round-trip
// =========================================================================
describe('encryptJsonPayload / decryptJsonPayload', () => {
  it('round-trips a simple object', async () => {
    const data = { region: 'CE', city: 'Yaoundé', gps_lat: 3.85 };
    const encrypted = await encryptJsonPayload('sess-1', data);

    expect(encrypted.iv_b64).toBeTruthy();
    expect(encrypted.ciphertext_b64).toBeTruthy();

    const decrypted = await decryptJsonPayload<typeof data>('sess-1', encrypted);
    expect(decrypted).toEqual(data);
  });

  it('round-trips non-ASCII text (Yaoundé, numéro)', async () => {
    const data = { lieu: 'Yaoundé', numéro_cni: '1234567890' };
    const encrypted = await encryptJsonPayload('sess-2', data);
    const decrypted = await decryptJsonPayload<typeof data>('sess-2', encrypted);
    expect(decrypted).toEqual(data);
  });

  it('round-trips a base64 data URL (signature image)', async () => {
    const data = { signature_data: 'data:image/png;base64,iVBORw0KGgo=' };
    const encrypted = await encryptJsonPayload('sess-3', data);
    const decrypted = await decryptJsonPayload<typeof data>('sess-3', encrypted);
    expect(decrypted).toEqual(data);
  });

  it('uses a different IV each time (non-deterministic encryption)', async () => {
    const data = { value: 'test' };
    const enc1 = await encryptJsonPayload('sess-4', data);
    const enc2 = await encryptJsonPayload('sess-4', data);
    // Same key, different IVs → different ciphertexts
    expect(enc1.iv_b64).not.toBe(enc2.iv_b64);
    expect(enc1.ciphertext_b64).not.toBe(enc2.ciphertext_b64);
  });

  it('fails to decrypt with the wrong session key', async () => {
    const data = { secret: 'value' };
    const encrypted = await encryptJsonPayload('sess-correct', data);
    await expect(
      decryptJsonPayload('sess-wrong', encrypted),
    ).rejects.toThrow();
  });
});

// =========================================================================
// 2. KYC state persistence
// =========================================================================
describe('persistKycState / loadPersistedKycState', () => {
  it('round-trips a complete KYC state', async () => {
    const state = makeKycState();
    await persistKycState(state);
    const loaded = await loadPersistedKycState();

    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('sess-1');
    expect(loaded!.currentStep).toBe('address');
    expect(loaded!.completedSteps).toContain('liveness');
  });

  it('returns null when no state has been persisted', async () => {
    const loaded = await loadPersistedKycState();
    expect(loaded).toBeNull();
  });

  it('overwrites previous state', async () => {
    await persistKycState(makeKycState({ currentStep: 'address' }));
    await persistKycState(makeKycState({ currentStep: 'consent' }));
    const loaded = await loadPersistedKycState();

    expect(loaded!.currentStep).toBe('consent');
  });

  it('migrates legacy RESTRICTED_ACCESS access level to RESTRICTED', async () => {
    // Manually craft a state with the legacy value
    await persistKycState(makeKycState({ accessLevel: 'RESTRICTED_ACCESS' as any }));
    const loaded = await loadPersistedKycState();
    expect(loaded!.accessLevel).toBe('RESTRICTED');
  });
});

// =========================================================================
// 3. Sync queue CRUD
// =========================================================================
describe('loadKycSyncQueue / persistKycSyncQueue', () => {
  it('returns empty array when no queue exists', async () => {
    const queue = await loadKycSyncQueue();
    expect(queue).toEqual([]);
  });

  it('persists and loads a queue', async () => {
    const items: KycSyncQueueItem[] = [
      {
        id: 'kycq-1',
        op_type: 'submit_address',
        session_id: 'sess-1',
        step: 'address',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
        client_sha256: null,
        meta: {},
        encrypted_payload: { iv_b64: 'AAAA', ciphertext_b64: 'AAAA' },
      },
    ];
    await persistKycSyncQueue(items);
    const loaded = await loadKycSyncQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('kycq-1');
    expect(loaded[0].op_type).toBe('submit_address');
  });
});

describe('enqueueKycSyncItem', () => {
  it('adds an item to the queue and encrypts the payload', async () => {
    const item = await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE', city: 'Yaoundé' },
    });

    expect(item.id).toMatch(/^kycq-/);
    expect(item.op_type).toBe('submit_address');
    expect(item.status).toBe('pending');
    expect(item.retry_count).toBe(0);
    expect(item.encrypted_payload.iv_b64).toBeTruthy();
    expect(item.encrypted_payload.ciphertext_b64).toBeTruthy();

    // Verify the encrypted payload can be decrypted back
    const decrypted = await decryptJsonPayload('sess-1', item.encrypted_payload);
    expect(decrypted).toEqual({ region: 'CE', city: 'Yaoundé' });
  });

  it('preserves existing queue items when adding a new one', async () => {
    await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });
    await enqueueKycSyncItem({
      op_type: 'submit_niu',
      session_id: 'sess-1',
      step: 'niu',
      payload: { niu_type: 'DECLARATIVE' },
    });

    const queue = await loadKycSyncQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].op_type).toBe('submit_address');
    expect(queue[1].op_type).toBe('submit_niu');
  });

  it('stores client_sha256 and meta when provided', async () => {
    const item = await enqueueKycSyncItem({
      op_type: 'capture_cni',
      session_id: 'sess-1',
      step: 'cni_recto',
      payload: { side: 'RECTO' },
      client_sha256: 'abc123',
      meta: { side: 'RECTO' },
    });

    expect(item.client_sha256).toBe('abc123');
    expect(item.meta).toEqual({ side: 'RECTO' });
  });

  it('defaults client_sha256 to null and meta to {} when omitted', async () => {
    const item = await enqueueKycSyncItem({
      op_type: 'submit_consent',
      session_id: 'sess-1',
      step: 'consent',
      payload: { cgu_accepted: true },
    });

    expect(item.client_sha256).toBeNull();
    expect(item.meta).toEqual({});
  });
});

describe('updateKycSyncItem', () => {
  it('updates an existing item by ID', async () => {
    const item = await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });

    const updated = await updateKycSyncItem(item.id, {
      status: 'failed',
      last_error: 'AUTH_REQUIRED',
      retry_count: 3,
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('failed');
    expect(updated!.last_error).toBe('AUTH_REQUIRED');
    expect(updated!.retry_count).toBe(3);
    expect(updated!.updated_at).toBeTruthy();
  });

  it('returns null for non-existent ID', async () => {
    const result = await updateKycSyncItem('nonexistent-id', { status: 'synced' });
    expect(result).toBeNull();
  });

  it('persists the update so loadKycSyncQueue reflects it', async () => {
    const item = await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });

    await updateKycSyncItem(item.id, { status: 'needs_reupload' });
    const queue = await loadKycSyncQueue();
    expect(queue[0].status).toBe('needs_reupload');
  });
});

describe('removeKycSyncItem', () => {
  it('removes an item by ID', async () => {
    const item1 = await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });
    const item2 = await enqueueKycSyncItem({
      op_type: 'submit_niu',
      session_id: 'sess-1',
      step: 'niu',
      payload: { niu_type: 'DECLARATIVE' },
    });

    await removeKycSyncItem(item1.id);
    const queue = await loadKycSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(item2.id);
  });

  it('does nothing for a non-existent ID', async () => {
    await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });

    await removeKycSyncItem('nonexistent-id');
    const queue = await loadKycSyncQueue();
    expect(queue).toHaveLength(1);
  });
});

describe('clearPersistedKycState', () => {
  it('clears state, queue, and session keys', async () => {
    await persistKycState(makeKycState());
    await enqueueKycSyncItem({
      op_type: 'submit_address',
      session_id: 'sess-1',
      step: 'address',
      payload: { region: 'CE' },
    });

    await clearPersistedKycState();

    expect(await loadPersistedKycState()).toBeNull();
    expect(await loadKycSyncQueue()).toEqual([]);
  });
});
