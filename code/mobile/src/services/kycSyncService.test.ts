/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for kycSyncService — offline enqueue & replay handlers.
 *
 * Mock strategy:
 * - kycOfflineStore: fully mocked (encrypt/decrypt, queue CRUD)
 * - apiClient/fetchWithCorrelation: mocked to simulate API responses
 * - sentry: mocked to capture error reports without side effects
 *
 * IMPORTANT: runKycSyncNow() calls ensureServerDraftSession() (a
 * fetchWithCorrelation call to /api/v1/kyc/session/start) whenever the
 * queue is non-empty. All replay tests must account for this.
 *
 * We use vi.restoreAllMocks() in beforeEach to fully reset mock state
 * (including mockResolvedValueOnce queues) between tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────
// NOTE: vi.mock factories are hoisted ABOVE imports, so we cannot reference
// const/let variables defined later. We use function declarations (which are
// also hoisted) or inline the logic directly.

// UTF-safe btoa: encodes multi-byte chars before base64 so 'Yaoundé' works in jsdom
function utfSafeBtoa(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function utfSafeAtob(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

// These function declarations are hoisted, so they're safe inside vi.mock factories.
function mockEncryptPayload(data: unknown) {
  const json = JSON.stringify(data);
  return { iv_b64: 'AAAA', ciphertext_b64: utfSafeBtoa(json) };
}
async function mockDecryptPayload<T>(_sid: string, enc: { ciphertext_b64: string }): Promise<T> {
  const json = utfSafeAtob(enc.ciphertext_b64);
  return JSON.parse(json) as T;
}

vi.mock('./kycOfflineStore', () => ({
  decryptJsonPayload: vi.fn().mockImplementation(mockDecryptPayload),
  encryptJsonPayload: vi.fn().mockImplementation(async (_sid: string, data: unknown) =>
    mockEncryptPayload(data),
  ),
  enqueueKycSyncItem: vi.fn().mockImplementation(async (input: any) => ({
    id: `kycq-test-${Date.now()}`,
    op_type: input.op_type,
    session_id: input.session_id,
    step: input.step,
    status: 'pending',
    retry_count: 0,
    next_retry_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
    client_sha256: input.client_sha256 ?? null,
    meta: input.meta ?? {},
    encrypted_payload: mockEncryptPayload(input.payload),
  })),
  loadKycSyncQueue: vi.fn().mockResolvedValue([]),
  loadPersistedKycState: vi.fn().mockResolvedValue(null),
  persistKycState: vi.fn().mockResolvedValue(undefined),
  removeKycSyncItem: vi.fn().mockResolvedValue(undefined),
  updateKycSyncItem: vi.fn().mockImplementation(async (_id: string, update: any) => ({
    id: _id,
    ...update,
    updated_at: new Date().toISOString(),
  })),
  persistKycSyncQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./apiClient', () => ({
  fetchWithCorrelation: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  apiClient: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./sentry', () => ({
  captureKycException: vi.fn(),
  captureKycMessage: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────

import {
  enqueueOfflineAddress,
  enqueueOfflineBill,
  enqueueOfflineNiu,
  enqueueOfflineConsent,
  enqueueOfflineSignature,
  enqueueOfflineCniCapture,
  enqueueOfflineLivenessCapture,
  runKycSyncNow,
  getKycSyncSummary,
  getResumeTargetPath,
  getSubmissionBlockerStatus,
} from './kycSyncService';

import {
  enqueueKycSyncItem,
  loadKycSyncQueue,
  removeKycSyncItem,
  updateKycSyncItem,
  loadPersistedKycState,
} from './kycOfflineStore';

import { fetchWithCorrelation } from './apiClient';
import { captureKycException, captureKycMessage } from './sentry';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeQueueItem(overrides: Partial<{
  id: string;
  op_type: string;
  session_id: string;
  step: string;
  status: string;
  retry_count: number;
  next_retry_at: string | null;
  encrypted_payload: any;
  client_sha256: string | null;
  meta: Record<string, any>;
  created_at: string;
}> = {}): any {
  return {
    id: overrides.id ?? `kycq-test-${Date.now()}`,
    op_type: overrides.op_type ?? 'submit_address',
    session_id: overrides.session_id ?? 'session-1',
    step: overrides.step ?? 'address',
    status: overrides.status ?? 'pending',
    retry_count: overrides.retry_count ?? 0,
    next_retry_at: overrides.next_retry_at ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
    client_sha256: overrides.client_sha256 ?? null,
    meta: overrides.meta ?? {},
    encrypted_payload: overrides.encrypted_payload ?? { iv_b64: 'AAAA', ciphertext_b64: utfSafeBtoa('{}') },
  };
}

function makeResponse(ok: boolean, status: number, body: any = {}): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

/** Find fetchWithCorrelation calls that targeted the given URL. */
function findFetchCallsByUrl(url: string): [url: string, init?: any][] {
  return (vi.mocked(fetchWithCorrelation).mock.calls as [string, any?][]).filter(c => c[0] === url);
}

/** Get all fetchWithCorrelation call URLs in order. */
function getFetchCallUrls(): string[] {
  return vi.mocked(fetchWithCorrelation).mock.calls.map(c => c[0]);
}

/**
 * Set up loadKycSyncQueue mock with queue snapshots for runKycSyncNow.
 *
 * runKycSyncNow calls loadKycSyncQueue:
 *  1. Initial load
 *  2. After ensureServerDraftSession (if queue was non-empty)
 *  3. After processing each item
 *
 * After all snapshots are consumed, the factory default ([]) is returned.
 */
function mockQueueForSync(...queueSnapshots: any[][]) {
  queueSnapshots.forEach((snapshot) => {
    vi.mocked(loadKycSyncQueue).mockResolvedValueOnce(snapshot);
  });
  // Factory default mockResolvedValue([]) handles remaining calls
}

// ── Test suites ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks(); // clears call history, preserves factory implementations
  // Reset functions that accumulate mockResolvedValueOnce / mockImplementation per test
  vi.mocked(loadKycSyncQueue).mockReset().mockResolvedValue([]);
  vi.mocked(fetchWithCorrelation).mockReset().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);
});

// =========================================================================
// 1. Enqueue functions
// =========================================================================
describe('enqueueOfflineAddress', () => {
  it('enqueues an item with op_type=submit_address and the address payload', async () => {
    await enqueueOfflineAddress({
      sessionId: 'sess-1',
      address: {
        region: 'CE',
        city: 'Yaoundé',
        commune: 'Yaoundé 1',
        quartier: 'Bastos',
        lieu_dit: 'Carrefour',
        gps_lat: 3.85,
        gps_lng: 11.5,
      },
    });

    expect(enqueueKycSyncItem).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('submit_address');
    expect(call.step).toBe('address');
    expect(call.session_id).toBe('sess-1');
    expect(call.payload.region).toBe('CE');
    expect(call.payload.city).toBe('Yaoundé');
    expect(call.payload.gps_lat).toBe(3.85);
    expect(call.payload.gps_lng).toBe(11.5);
    expect(call.meta.region).toBe('CE');
    expect(call.meta.city).toBe('Yaoundé');
  });
});

describe('enqueueOfflineBill', () => {
  it('enqueues an item with op_type=submit_bill and bill payload including data URL', async () => {
    // Use a well-formed 1x1 PNG data URL for consistency with replay tests
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';
    const dataUrl = png1x1;
    await enqueueOfflineBill({
      sessionId: 'sess-1',
      billType: 'ENEO',
      fileDataUrl: dataUrl,
      clientSha256: 'abc123',
    });

    expect(enqueueKycSyncItem).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('submit_bill');
    expect(call.step).toBe('utility_bill');
    expect(call.payload.file_data_url).toBe(dataUrl);
    expect(call.payload.bill_type).toBe('ENEO');
    expect(call.payload.session_id).toBe('sess-1');
    expect(call.payload.client_sha256).toBe('abc123');
    expect(call.client_sha256).toBe('abc123');
    expect(call.meta.bill_type).toBe('ENEO');
  });

  it('defaults clientSha256 to null when omitted', async () => {
    await enqueueOfflineBill({
      sessionId: 'sess-2',
      billType: 'CAMWATER',
      fileDataUrl: 'data:image/jpeg;base64,/9j/',
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.client_sha256).toBeNull();
    expect(call.payload.client_sha256).toBeNull();
    expect(call.meta.bill_type).toBe('CAMWATER');
  });
});

describe('enqueueOfflineNiu', () => {
  it('enqueues an item with op_type=submit_niu and NIU payload', async () => {
    await enqueueOfflineNiu({
      sessionId: 'sess-1',
      niuType: 'DECLARATIVE',
      niuValue: 'M123456789A',
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('submit_niu');
    expect(call.step).toBe('niu');
    expect(call.payload.niu_type).toBe('DECLARATIVE');
    expect(call.payload.niu_value).toBe('M123456789A');
    expect(call.meta.niu_type).toBe('DECLARATIVE');
  });

  it('handles null niuValue for uploaded NIU', async () => {
    await enqueueOfflineNiu({
      sessionId: 'sess-1',
      niuType: 'NIU_PDF',
      niuValue: null,
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.payload.niu_value).toBeNull();
  });
});

describe('enqueueOfflineConsent', () => {
  it('enqueues an item with op_type=submit_consent and consent payload', async () => {
    await enqueueOfflineConsent({
      sessionId: 'sess-1',
      cguAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('submit_consent');
    expect(call.step).toBe('consent');
    expect(call.payload.cgu_accepted).toBe(true);
    expect(call.payload.privacy_accepted).toBe(true);
    expect(call.payload.data_processing_accepted).toBe(true);
    expect(call.meta.cgu_accepted).toBe('true');
  });

  it('enqueues with all consent flags false', async () => {
    await enqueueOfflineConsent({
      sessionId: 'sess-2',
      cguAccepted: false,
      privacyAccepted: false,
      dataProcessingAccepted: false,
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.payload.cgu_accepted).toBe(false);
  });
});

describe('enqueueOfflineSignature', () => {
  it('enqueues an item with op_type=submit_signature and signature payload', async () => {
    const fileDataUrl = 'data:image/jpeg;base64,sigdata';
    await enqueueOfflineSignature({
      sessionId: 'sess-1',
      fileDataUrl: fileDataUrl,
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('submit_signature');
    expect(call.step).toBe('signature');
    expect(call.payload.file_data_url).toBe(fileDataUrl);
    expect(call.meta).toBeUndefined();
  });
});

// =========================================================================
// 2. Replay handlers (via runKycSyncNow)
// =========================================================================
describe('replay: submit_address', () => {
  it('calls /api/v1/kyc/address/submit and removes the queue item on success', async () => {
    const payload = {
      region: 'CE', city: 'Yaoundé', commune: 'Yaoundé 1',
      quartier: 'Bastos', gps_lat: 3.85, gps_lng: 11.5,
    };
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      encrypted_payload: mockEncryptPayload(payload),
    });

    mockQueueForSync([item], [item], []);
    await runKycSyncNow();

    const calls = findFetchCallsByUrl('/api/v1/kyc/address/submit');
    expect(calls).toHaveLength(1);
    const bodyArg = JSON.parse(calls[0][1].body);
    expect(bodyArg.region).toBe('CE');
    expect(bodyArg.gps_lat).toBe(3.85);
    expect(removeKycSyncItem).toHaveBeenCalledWith(item.id);
  });

  it('classifies 409 as HASH_MISMATCH / needs_reupload', async () => {
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      encrypted_payload: mockEncryptPayload({ region: 'CE', city: 'Yaoundé' }),
    });

    mockQueueForSync([item], [item], []);
    vi.mocked(fetchWithCorrelation).mockResolvedValue(makeResponse(false, 409, { detail: 'Conflict' }) as unknown as Response);

    await runKycSyncNow();

    expect(removeKycSyncItem).not.toHaveBeenCalled();
    expect(updateKycSyncItem).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ status: 'needs_reupload' }),
    );
  });

  it('classifies 401 as AUTH_REQUIRED / failed', async () => {
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });

    mockQueueForSync([item], [item], []);
    vi.mocked(fetchWithCorrelation).mockResolvedValue(makeResponse(false, 401) as unknown as Response);

    await runKycSyncNow();

    expect(updateKycSyncItem).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('retries on 500 server error', async () => {
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });

    mockQueueForSync([item], [item], []);
    vi.mocked(fetchWithCorrelation).mockResolvedValue(makeResponse(false, 500) as unknown as Response);

    await runKycSyncNow();

    expect(updateKycSyncItem).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({
        status: 'pending',
        retry_count: 1,
        next_retry_at: expect.any(String),
      }),
    );
  });
});

describe('replay: submit_bill', () => {
  it('calls /api/v1/kyc/capture/bill with FormData and removes queue item on success', async () => {
    // Use a well-formed 1x1 PNG data URL so dataUrlToBlob works in jsdom
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';
    const payload = {
      file_data_url: png1x1,
      bill_type: 'ENEO',
      session_id: 'sess-1',
      client_sha256: null,
    };
    const item = makeQueueItem({
      op_type: 'submit_bill',
      step: 'utility_bill',
      encrypted_payload: mockEncryptPayload(payload),
    });

    mockQueueForSync([item], [item], []);
    await runKycSyncNow();

    const calls = findFetchCallsByUrl('/api/v1/kyc/capture/bill');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toBeInstanceOf(FormData);
    expect(removeKycSyncItem).toHaveBeenCalledWith(item.id);
  });

  it('classifies 404 as SESSION_NOT_FOUND / failed', async () => {
    const item = makeQueueItem({
      op_type: 'submit_bill',
      step: 'utility_bill',
      encrypted_payload: mockEncryptPayload({ file_data_url: 'x', bill_type: 'ENEO' }),
    });

    mockQueueForSync([item], [item], []);
    vi.mocked(fetchWithCorrelation).mockResolvedValue(makeResponse(false, 404) as unknown as Response);

    await runKycSyncNow();

    expect(updateKycSyncItem).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ status: 'failed' }),
    );
  });
});

describe('replay: submit_niu', () => {
  it('calls /api/v1/kyc/niu/submit and removes queue item on success', async () => {
    const payload = { niu_type: 'DECLARATIVE', niu_value: 'M1234A' };
    const item = makeQueueItem({
      op_type: 'submit_niu',
      step: 'niu',
      encrypted_payload: mockEncryptPayload(payload),
    });

    mockQueueForSync([item], [item], []);
    await runKycSyncNow();

    const calls = findFetchCallsByUrl('/api/v1/kyc/niu/submit');
    expect(calls).toHaveLength(1);
    const bodyArg = JSON.parse(calls[0][1].body);
    expect(bodyArg.niu_type).toBe('DECLARATIVE');
    expect(bodyArg.niu_value).toBe('M1234A');
    expect(removeKycSyncItem).toHaveBeenCalledWith(item.id);
  });
});

describe('replay: submit_consent', () => {
  it('calls /api/v1/kyc/consent/submit and removes queue item on success', async () => {
    const payload = {
      cgu_accepted: true,
      privacy_accepted: true,
      data_processing_accepted: true,
    };
    const item = makeQueueItem({
      op_type: 'submit_consent',
      step: 'consent',
      encrypted_payload: mockEncryptPayload(payload),
    });

    mockQueueForSync([item], [item], []);
    await runKycSyncNow();

    const calls = findFetchCallsByUrl('/api/v1/kyc/consent/submit');
    expect(calls).toHaveLength(1);
    const bodyArg = JSON.parse(calls[0][1].body);
    expect(bodyArg.cgu_accepted).toBe(true);
    expect(bodyArg.privacy_accepted).toBe(true);
    expect(bodyArg.data_processing_accepted).toBe(true);
    expect(removeKycSyncItem).toHaveBeenCalledWith(item.id);
  });
});

describe('replay: submit_signature', () => {
  it('uploads document then calls /api/v1/kyc/signature/submit and removes queue item on success', async () => {
    const payload = { file_data_url: 'data:image/jpeg;base64,c2ln' };
    const item = makeQueueItem({
      op_type: 'submit_signature',
      step: 'signature',
      encrypted_payload: mockEncryptPayload(payload),
    });

    mockQueueForSync([item], [item], []);

    vi.mocked(fetchWithCorrelation).mockImplementation(async (url: string) => {
      if (url === '/api/v1/kyc/session/start') {
        return makeResponse(true, 200, { status: 'DRAFT', session_id: 'sess-1' });
      }
      if (url === '/api/v1/kyc/document/upload') {
        return makeResponse(true, 200, { id: 'doc_handle_abc', doc_type: 'SIGNATURE_SHEET' });
      }
      if (url === '/api/v1/kyc/signature/submit') {
        return makeResponse(true, 200, { status: 'success' });
      }
      return makeResponse(true, 200, {});
    });

    await runKycSyncNow();

    const docUploadCalls = findFetchCallsByUrl('/api/v1/kyc/document/upload');
    expect(docUploadCalls).toHaveLength(1);

    const signatureCalls = findFetchCallsByUrl('/api/v1/kyc/signature/submit');
    expect(signatureCalls).toHaveLength(1);
    const bodyArg = JSON.parse(signatureCalls[0][1].body);
    expect(bodyArg.document_id).toBe('doc_handle_abc');
    expect(removeKycSyncItem).toHaveBeenCalledWith(item.id);
  });
});

// =========================================================================
// 3. Queue processing & error classification
// =========================================================================
describe('runKycSyncNow queue processing', () => {
  it('skips items with status !== pending', async () => {
    const pendingItem = makeQueueItem({
      op_type: 'submit_address',
      status: 'pending',
      step: 'address',
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });
    const failedItem = makeQueueItem({ id: 'failed-1', op_type: 'submit_niu', step: 'niu', status: 'failed' });
    const reuploadItem = makeQueueItem({ id: 'reu-1', op_type: 'submit_bill', step: 'utility_bill', status: 'needs_reupload' });

    const allItems = [pendingItem, failedItem, reuploadItem];
    mockQueueForSync(allItems, allItems, []);
    await runKycSyncNow();

    const urls = getFetchCallUrls();
    expect(urls).toContain('/api/v1/kyc/address/submit');
    expect(urls).not.toContain('/api/v1/kyc/niu/submit');
    expect(removeKycSyncItem).toHaveBeenCalledOnce();
    expect(removeKycSyncItem).toHaveBeenCalledWith(pendingItem.id);
  });

  it('skips items whose next_retry_at is in the future', async () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      status: 'pending',
      next_retry_at: futureTime,
    });

    // Queue has items → session/start fires, but item is skipped (future retry)
    mockQueueForSync([item], [item]);
    await runKycSyncNow();

    // Only session/start should be called — no replay endpoint
    const urls = getFetchCallUrls();
    expect(urls).toContain('/api/v1/kyc/session/start');
    expect(urls).not.toContain('/api/v1/kyc/address/submit');
  });

  it('processes items with past next_retry_at', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      status: 'pending',
      next_retry_at: pastTime,
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });

    mockQueueForSync([item], [item], []);
    await runKycSyncNow();

    const calls = findFetchCallsByUrl('/api/v1/kyc/address/submit');
    expect(calls).toHaveLength(1);
  });

  it('skips liveness if CNI capture is still pending', async () => {
    const cniItem = makeQueueItem({
      id: 'cni-1',
      op_type: 'capture_cni',
      session_id: 'sess-1',
      step: 'cni_recto',
      encrypted_payload: mockEncryptPayload({
        file_data_url: 'data:image/png;base64,AA',
        side: 'RECTO',
        session_id: 'sess-1',
      }),
    });
    const livenessItem = makeQueueItem({
      id: 'live-1',
      op_type: 'capture_liveness',
      session_id: 'sess-1',
      step: 'liveness',
      encrypted_payload: mockEncryptPayload({
        challenge_type: 'smile',
        landmarks_json: [],
      }),
    });

    const allItems = [cniItem, livenessItem];
    // CNI upload fails with 500 → stays pending → liveness gets deferred
    mockQueueForSync(allItems, allItems, allItems, allItems);

    // Make CNI upload fail so it stays pending in the queue
    vi.mocked(fetchWithCorrelation).mockImplementation(((url: string) => {
      if (url === '/api/v1/kyc/capture/cni') return Promise.resolve(makeResponse(false, 500));
      return Promise.resolve(makeResponse(true, 200));
    }) as typeof fetchWithCorrelation);

    await runKycSyncNow();

    // The liveness item should have been deferred
    const updateCalls = vi.mocked(updateKycSyncItem).mock.calls;
    const livenessDeferCall = updateCalls.find(c => c[0] === 'live-1');
    expect(livenessDeferCall).toBeDefined();
    expect(livenessDeferCall![1].last_error).toBe('WAITING_FOR_CNI_SYNC');
  });

  it('handles network errors as retryable', async () => {
    const item = makeQueueItem({
      op_type: 'submit_niu',
      step: 'niu',
      encrypted_payload: mockEncryptPayload({ niu_type: 'DECLARATIVE' }),
    });

    mockQueueForSync([item], [item], []);
    // session/start succeeds, NIU submit throws network error
    vi.mocked(fetchWithCorrelation).mockImplementation(((url: string) => {
      if (url === '/api/v1/kyc/niu/submit') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(makeResponse(true, 200));
    }) as typeof fetchWithCorrelation);

    await runKycSyncNow();

    expect(captureKycException).toHaveBeenCalled();
    expect(updateKycSyncItem).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({
        status: 'pending',
        retry_count: 1,
      }),
    );
  });

  it('does not run if navigator is offline', async () => {
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await runKycSyncNow();

    expect(loadKycSyncQueue).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'onLine', { value: originalOnline, configurable: true });
  });

  it('does not run concurrently (inFlight guard)', async () => {
    const item = makeQueueItem({
      op_type: 'submit_address',
      step: 'address',
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });

    mockQueueForSync([item], [item], []);

    // Make address/submit hang; session/start resolves immediately
    let resolveAddressFetch!: () => void;
    vi.mocked(fetchWithCorrelation).mockImplementation(((url: string) => {
      if (url === '/api/v1/kyc/address/submit') {
        return new Promise<Response>(r => { resolveAddressFetch = () => r(makeResponse(true, 200)); });
      }
      return Promise.resolve(makeResponse(true, 200));
    }) as typeof fetchWithCorrelation);

    // Start first sync (will hang at address/submit)
    const first = runKycSyncNow();

    // Wait one tick so the first sync progresses to the hanging fetch
    await new Promise(r => setTimeout(r, 0));

    // Record how many times loadKycSyncQueue was called before second sync
    const callsBefore = vi.mocked(loadKycSyncQueue).mock.calls.length;

    // Second sync should be a no-op due to inFlight guard
    await runKycSyncNow();

    // No additional loadKycSyncQueue calls from the second sync
    expect(vi.mocked(loadKycSyncQueue).mock.calls.length).toBe(callsBefore);

    // Let the first sync complete
    resolveAddressFetch();
    await first;
  });

  it('processes queue items in step-priority order', async () => {
    const addressItem = makeQueueItem({
      id: 'addr-1',
      op_type: 'submit_address',
      step: 'address',
      created_at: new Date(Date.now() - 5000).toISOString(),
      encrypted_payload: mockEncryptPayload({ region: 'CE' }),
    });
    const niuItem = makeQueueItem({
      id: 'niu-1',
      op_type: 'submit_niu',
      step: 'niu',
      created_at: new Date(Date.now() - 10000).toISOString(),
      encrypted_payload: mockEncryptPayload({ niu_type: 'DECLARATIVE' }),
    });

    // Return items in reverse priority order (niu=70 > address=60)
    const allItems = [niuItem, addressItem];
    mockQueueForSync(allItems, allItems, allItems, []);
    await runKycSyncNow();

    // Filter out session/start, check replay order
    const replayUrls = getFetchCallUrls().filter(u => u !== '/api/v1/kyc/session/start');
    expect(replayUrls[0]).toBe('/api/v1/kyc/address/submit');
    expect(replayUrls[1]).toBe('/api/v1/kyc/niu/submit');
  });
});

// =========================================================================
// 4. Unknown op_type handling
// =========================================================================
describe('unknown op_type in processQueueItem', () => {
  it('logs a Sentry message for unknown op_type and does not crash', async () => {
    const item = makeQueueItem({
      op_type: 'unknown_future_op' as any,
      step: 'address',
      encrypted_payload: mockEncryptPayload({}),
    });

    mockQueueForSync([item], [item], []);

    await runKycSyncNow();

    expect(captureKycMessage).toHaveBeenCalledWith(
      expect.stringContaining('unknown_future_op'),
      'sync_error',
      expect.any(Object),
    );
    // Unknown op_type should NOT remove or update the queue item — it stays as-is
    expect(removeKycSyncItem).not.toHaveBeenCalled();
    expect(updateKycSyncItem).not.toHaveBeenCalled();
  });
});

// =========================================================================
// 5. getKycSyncSummary
// =========================================================================
describe('getKycSyncSummary', () => {
  it('returns correct counts for pending, needs_reupload, failed', async () => {
    const queue = [
      makeQueueItem({ id: '1', status: 'pending' }),
      makeQueueItem({ id: '2', status: 'pending' }),
      makeQueueItem({ id: '3', status: 'needs_reupload' }),
      makeQueueItem({ id: '4', status: 'failed' }),
      makeQueueItem({ id: '5', status: 'synced' }),
    ];

    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    vi.mocked(loadPersistedKycState).mockResolvedValue({
      sessionId: 'sess-1',
      status: 'DRAFT',
      currentStep: 'liveness',
      completedSteps: ['cni_recto'],
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
    });

    const summary = await getKycSyncSummary();

    expect(summary.pendingCount).toBe(2);
    expect(summary.needsReuploadCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.hasResumeData).toBe(true);
  });

  it('returns hasResumeData=false when all steps are complete', async () => {
    vi.mocked(loadKycSyncQueue).mockResolvedValue([]);
    vi.mocked(loadPersistedKycState).mockResolvedValue({
      sessionId: 'sess-1',
      status: 'SUBMITTED',
      currentStep: 'submission',
      completedSteps: [
        'cni_recto', 'cni_verso', 'ocr_review', 'liveness',
        'utility_bill', 'address', 'niu', 'consent', 'signature', 'submission',
      ],
      accessLevel: 'FULL',
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
    } as any);

    const summary = await getKycSyncSummary();
    expect(summary.hasResumeData).toBe(false);
  });
});

// =========================================================================
// 6. getSubmissionBlockerStatus
// =========================================================================
describe('getSubmissionBlockerStatus', () => {
  it('allows submission when queue is empty', async () => {
    vi.mocked(loadKycSyncQueue).mockResolvedValue([]);
    const status = await getSubmissionBlockerStatus();
    expect(status.canSubmit).toBe(true);
    expect(status.blockingReason).toBeNull();
  });

  it('blocks when critical items need reupload', async () => {
    const queue = [
      makeQueueItem({ op_type: 'capture_cni', status: 'needs_reupload' }),
    ];
    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    const status = await getSubmissionBlockerStatus();
    expect(status.canSubmit).toBe(false);
    expect(status.actionRequiredCount).toBe(1);
  });

  it('blocks when critical items have failed', async () => {
    const queue = [
      makeQueueItem({ op_type: 'capture_liveness', status: 'failed' }),
    ];
    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    const status = await getSubmissionBlockerStatus();
    expect(status.canSubmit).toBe(false);
    expect(status.actionRequiredCount).toBe(1);
  });

  it('blocks when critical items are still pending', async () => {
    const queue = [
      makeQueueItem({ op_type: 'capture_cni', status: 'pending' }),
    ];
    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    const status = await getSubmissionBlockerStatus();
    expect(status.canSubmit).toBe(false);
    expect(status.pendingCriticalCount).toBe(1);
  });

  it('does not block for non-critical items (address, niu, etc.)', async () => {
    const queue = [
      makeQueueItem({ op_type: 'submit_address', status: 'pending' }),
      makeQueueItem({ op_type: 'submit_niu', status: 'failed' }),
    ];
    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    const status = await getSubmissionBlockerStatus();
    expect(status.canSubmit).toBe(true);
  });
});

// =========================================================================
// 7. getResumeTargetPath
// =========================================================================
describe('getResumeTargetPath', () => {
  it('returns CNI recto capture when needs_reupload for RECTO', async () => {
    const queue = [
      makeQueueItem({ op_type: 'capture_cni', status: 'needs_reupload', meta: { side: 'RECTO' } }),
    ];
    vi.mocked(loadKycSyncQueue).mockResolvedValue(queue);
    const path = await getResumeTargetPath();
    expect(path).toBe('/kyc/cni-recto-capture');
  });

  it('returns first incomplete step path from persisted state', async () => {
    vi.mocked(loadKycSyncQueue).mockResolvedValue([]);
    vi.mocked(loadPersistedKycState).mockResolvedValue({
      sessionId: 'sess-1',
      status: 'DRAFT',
      currentStep: 'liveness',
      completedSteps: ['cni_recto', 'cni_verso', 'ocr_review'],
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
    });

    const path = await getResumeTargetPath();
    expect(path).toBe('/kyc/liveness');
  });

  it('returns null when no state and no reupload items', async () => {
    vi.mocked(loadKycSyncQueue).mockResolvedValue([]);
    vi.mocked(loadPersistedKycState).mockResolvedValue(null);
    const path = await getResumeTargetPath();
    expect(path).toBeNull();
  });
});

// =========================================================================
// 8. Existing enqueue functions (CNI + Liveness) — regression coverage
// =========================================================================
describe('enqueueOfflineCniCapture (regression)', () => {
  it('enqueues with op_type=capture_cni and includes side + sha256', async () => {
    await enqueueOfflineCniCapture({
      sessionId: 'sess-1',
      side: 'RECTO',
      step: 'cni_recto',
      fileDataUrl: 'data:image/png;base64,cniData',
      clientSha256: 'sha256abc',
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('capture_cni');
    expect(call.step).toBe('cni_recto');
    expect(call.client_sha256).toBe('sha256abc');
    expect(call.payload.side).toBe('RECTO');
    expect(call.meta.side).toBe('RECTO');
  });
});

describe('enqueueOfflineLivenessCapture (regression)', () => {
  it('enqueues with op_type=capture_liveness and includes challenge_type', async () => {
    await enqueueOfflineLivenessCapture({
      sessionId: 'sess-1',
      challengeType: 'smile',
      landmarks: [{ x: 0.5, y: 0.5 }],
    });

    const call = vi.mocked(enqueueKycSyncItem).mock.calls[0][0] as any;
    expect(call.op_type).toBe('capture_liveness');
    expect(call.step).toBe('liveness');
    expect(call.payload.challenge_type).toBe('smile');
    expect(call.meta.challenge_type).toBe('smile');
  });
});
