import type { AddressData, OcrField, KycStepType, KycStatus, AccessLevel } from '../types';

const DB_NAME = 'vp_kyc_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const KYC_STATE_KEY = 'kyc_state_v1';
const KYC_QUEUE_KEY = 'kyc_queue_v1';
const KYC_SESSION_KEYS_KEY = 'kyc_session_keys_v1';

export type QueueOpType = 'capture_cni' | 'capture_liveness';
export type QueueStatus = 'pending' | 'synced' | 'needs_reupload' | 'failed';

export interface PersistedKycState {
  sessionId: string | null;
  status: KycStatus;
  currentStep: KycStepType;
  completedSteps: KycStepType[];
  accessLevel: AccessLevel;
  cniRectoCapture: string | null;
  cniVersoCapture: string | null;
  ocrFields: OcrField[];
  livenessAttempts: number;
  address: AddressData | null;
  billCapture: string | null;
  niuCapture: string | null;
  niuManual: string | null;
  consentCgu: boolean;
  consentPrivacy: boolean;
  consentData: boolean;
  signatureData: string | null;
  selectedPlan: string | null;
  interests: string[];
}

export interface EncryptedPayload {
  iv_b64: string;
  ciphertext_b64: string;
}

export interface KycSyncQueueItem {
  id: string;
  op_type: QueueOpType;
  session_id: string;
  step: KycStepType;
  status: QueueStatus;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  last_error: string | null;
  client_sha256?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  encrypted_payload: EncryptedPayload;
}

interface PersistedEnvelope<T> {
  version: number;
  updatedAt: string;
  value: T;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function openDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function dbGet<T>(key: string): Promise<T | null> {
  if (!isIndexedDbAvailable()) return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
    });
  } finally {
    db.close();
  }
}

async function dbSet<T>(key: string, value: T): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('IndexedDB write failed'));
    });
  } finally {
    db.close();
  }
}

async function dbDelete(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('IndexedDB delete failed'));
    });
  } finally {
    db.close();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadSessionKeyMap(): Promise<Record<string, string>> {
  const envelope = await dbGet<PersistedEnvelope<Record<string, string>>>(KYC_SESSION_KEYS_KEY);
  if (!envelope || envelope.version !== 1 || !envelope.value) {
    return {};
  }
  return envelope.value;
}

async function saveSessionKeyMap(map: Record<string, string>): Promise<void> {
  await dbSet<PersistedEnvelope<Record<string, string>>>(KYC_SESSION_KEYS_KEY, {
    version: 1,
    updatedAt: nowIso(),
    value: map,
  });
}

async function getOrCreateRawSessionKey(sessionId: string): Promise<string> {
  const keyMap = await loadSessionKeyMap();
  const existing = keyMap[sessionId];
  if (existing) return existing;

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const rawKeyB64 = bytesToBase64(rawKey);
  keyMap[sessionId] = rawKeyB64;
  await saveSessionKeyMap(keyMap);
  return rawKeyB64;
}

async function importSessionKey(sessionId: string): Promise<CryptoKey> {
  const rawKeyB64 = await getOrCreateRawSessionKey(sessionId);
  return await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(base64ToBytes(rawKeyB64)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJsonPayload<T>(sessionId: string, value: T): Promise<EncryptedPayload> {
  const key = await importSessionKey(sessionId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJsonPayload<T>(sessionId: string, encrypted: EncryptedPayload): Promise<T> {
  const key = await importSessionKey(sessionId);
  const iv = base64ToBytes(encrypted.iv_b64);
  const ciphertext = base64ToBytes(encrypted.ciphertext_b64);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  const decoded = new TextDecoder().decode(plaintext);
  return JSON.parse(decoded) as T;
}

export async function loadPersistedKycState(): Promise<PersistedKycState | null> {
  const envelope = await dbGet<PersistedEnvelope<PersistedKycState>>(KYC_STATE_KEY);
  if (!envelope || envelope.version !== 1 || !envelope.value) {
    return null;
  }
  return envelope.value;
}

export async function persistKycState(state: PersistedKycState): Promise<void> {
  await dbSet<PersistedEnvelope<PersistedKycState>>(KYC_STATE_KEY, {
    version: 1,
    updatedAt: nowIso(),
    value: state,
  });
}

export async function loadKycSyncQueue(): Promise<KycSyncQueueItem[]> {
  const envelope = await dbGet<PersistedEnvelope<KycSyncQueueItem[]>>(KYC_QUEUE_KEY);
  if (!envelope || envelope.version !== 1 || !Array.isArray(envelope.value)) {
    return [];
  }
  return envelope.value;
}

export async function persistKycSyncQueue(queue: KycSyncQueueItem[]): Promise<void> {
  await dbSet<PersistedEnvelope<KycSyncQueueItem[]>>(KYC_QUEUE_KEY, {
    version: 1,
    updatedAt: nowIso(),
    value: queue,
  });
}

export async function enqueueKycSyncItem(input: {
  op_type: QueueOpType;
  session_id: string;
  step: KycStepType;
  client_sha256?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  payload: unknown;
}): Promise<KycSyncQueueItem> {
  const queue = await loadKycSyncQueue();
  const encrypted_payload = await encryptJsonPayload(input.session_id, input.payload);
  const timestamp = nowIso();
  const item: KycSyncQueueItem = {
    id: randomId('kycq'),
    op_type: input.op_type,
    session_id: input.session_id,
    step: input.step,
    status: 'pending',
    retry_count: 0,
    next_retry_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    last_error: null,
    client_sha256: input.client_sha256 ?? null,
    meta: input.meta ?? {},
    encrypted_payload,
  };
  queue.push(item);
  await persistKycSyncQueue(queue);
  return item;
}

export async function updateKycSyncItem(
  itemId: string,
  update: Partial<KycSyncQueueItem>,
): Promise<KycSyncQueueItem | null> {
  const queue = await loadKycSyncQueue();
  const idx = queue.findIndex((x) => x.id === itemId);
  if (idx < 0) return null;
  queue[idx] = {
    ...queue[idx],
    ...update,
    updated_at: nowIso(),
  };
  await persistKycSyncQueue(queue);
  return queue[idx];
}

export async function removeKycSyncItem(itemId: string): Promise<void> {
  const queue = await loadKycSyncQueue();
  const next = queue.filter((item) => item.id !== itemId);
  await persistKycSyncQueue(next);
}

export async function clearPersistedKycState(): Promise<void> {
  await dbDelete(KYC_STATE_KEY);
  await dbDelete(KYC_QUEUE_KEY);
  await dbDelete(KYC_SESSION_KEYS_KEY);
}
