import { apiClient, fetchWithCorrelation } from './apiClient';
import type { KycStepType, LivenessResult, AddressData } from '../types';
import {
  decryptJsonPayload,
  enqueueKycSyncItem,
  loadKycSyncQueue,
  loadPersistedKycState,
  persistKycState,
  removeKycSyncItem,
  updateKycSyncItem,
  type KycSyncQueueItem,
} from './kycOfflineStore';
import { captureKycException, captureKycMessage } from './sentry';

const RETRY_DELAYS_SECONDS = [2, 5, 15];

interface CniPayload {
  file_data_url: string;
  side: 'RECTO' | 'VERSO';
  session_id?: string | null;
  client_sha256?: string | null;
}

interface LivenessPayload {
  landmarks_json: Array<Record<string, unknown>>;
  challenge_type: 'smile' | 'blink' | 'turn_left' | 'turn_right';
  selfie_data_url?: string;
}

interface AddressPayload {
  region: string;
  city: string;
  commune: string;
  quartier: string;
  lieu_dit?: string;
  gps_lat?: number;
  gps_lng?: number;
}

interface BillPayload {
  file_data_url: string;
  bill_type: 'ENEO' | 'CAMWATER';
  session_id?: string | null;
  client_sha256?: string | null;
}

interface NiuPayload {
  niu_type: string;
  niu_value?: string | null;
}

interface ConsentPayload {
  cgu_accepted: boolean;
  privacy_accepted: boolean;
  data_processing_accepted: boolean;
}

interface SignaturePayload {
  signature_data: string;
}

export interface QueueSummary {
  pendingCount: number;
  needsReuploadCount: number;
  failedCount: number;
  hasResumeData: boolean;
}

export interface SubmissionBlockerStatus {
  canSubmit: boolean;
  blockingReason: string | null;
  pendingCriticalCount: number;
  actionRequiredCount: number;
}

let inFlight = false;
const STEP_PRIORITY: Record<KycStepType, number> = {
  cni_recto: 10,
  cni_verso: 20,
  ocr_review: 30,
  liveness: 40,
  utility_bill: 50,
  address: 60,
  niu: 70,
  consent: 80,
  signature: 90,
  submission: 100,
};

class SyncError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly queueStatus: 'pending' | 'needs_reupload' | 'failed';

  constructor(
    message: string,
    options: {
      code: string;
      retryable: boolean;
      queueStatus: 'pending' | 'needs_reupload' | 'failed';
    },
  ) {
    super(message);
    this.name = 'SyncError';
    this.code = options.code;
    this.retryable = options.retryable;
    this.queueStatus = options.queueStatus;
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, content] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(meta || '');
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(content || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function firstIncompleteStep(completedSteps: KycStepType[]): KycStepType {
  const sequence: KycStepType[] = [
    'cni_recto',
    'cni_verso',
    'ocr_review',
    'liveness',
    'utility_bill',
    'address',
    'niu',
    'consent',
    'signature',
    'submission',
  ];
  return sequence.find((step) => !completedSteps.includes(step)) ?? 'submission';
}

function nextRetryAt(retryCount: number): string {
  const idx = Math.min(retryCount, RETRY_DELAYS_SECONDS.length - 1);
  const date = new Date(Date.now() + RETRY_DELAYS_SECONDS[idx] * 1000);
  return date.toISOString();
}

function isNetworkLikeError(error: unknown): boolean {
  if (error instanceof SyncError) return false;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch');
}

function classifyHttpSyncError(
  responseStatus: number,
  operation: string,
  detail?: unknown,
): SyncError {
  const detailText =
    typeof detail === 'string'
      ? detail
      : (detail && typeof detail === 'object' && 'message' in (detail as Record<string, unknown>))
        ? String((detail as Record<string, unknown>).message)
        : `HTTP_${responseStatus}`;

  if (responseStatus === 409) {
    return new SyncError(`${operation}_hash_mismatch`, {
      code: 'HASH_MISMATCH',
      retryable: false,
      queueStatus: 'needs_reupload',
    });
  }
  if (responseStatus === 401 || responseStatus === 403) {
    return new SyncError(`${operation}_auth_required`, {
      code: 'AUTH_REQUIRED',
      retryable: false,
      queueStatus: 'failed',
    });
  }
  if (responseStatus === 404) {
    return new SyncError(`${operation}_session_not_found`, {
      code: 'SESSION_NOT_FOUND',
      retryable: false,
      queueStatus: 'failed',
    });
  }
  if (responseStatus >= 500) {
    return new SyncError(`${operation}_server_error_${responseStatus}`, {
      code: 'SERVER_ERROR',
      retryable: true,
      queueStatus: 'pending',
    });
  }
  return new SyncError(`${operation}_validation_error_${responseStatus}:${detailText}`, {
    code: 'VALIDATION_ERROR',
    retryable: false,
    queueStatus: 'failed',
  });
}

async function ensureServerDraftSession(): Promise<void> {
  try {
    await fetchWithCorrelation('/api/v1/kyc/session/start', {
      method: 'POST',
    });
  } catch {
    // Best effort; replay will fail gracefully and retry on network recovery.
  }
}

async function markCaptureAsPurged(step: KycStepType): Promise<void> {
  const state = await loadPersistedKycState();
  if (!state) return;
  if (step === 'cni_recto') {
    state.cniRectoCapture = null;
  }
  if (step === 'cni_verso') {
    state.cniVersoCapture = null;
  }
  await persistKycState(state);
}

async function uploadCni(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<CniPayload>(item.session_id, item.encrypted_payload);
  const formData = new FormData();
  formData.append('file', dataUrlToBlob(payload.file_data_url), `cni_${payload.side.toLowerCase()}.jpg`);
  formData.append('side', payload.side);
  if (payload.session_id) {
    formData.append('session_id', payload.session_id);
  }
  if (payload.client_sha256) {
    formData.append('client_sha256', payload.client_sha256);
  }

  const response = await fetchWithCorrelation('/api/v1/kyc/capture/cni', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'capture_cni', detail);
  }

  const body = (await response.json()) as { sha256_hash?: string };
  const serverSha = (body.sha256_hash || '').toLowerCase();
  const clientSha = (item.client_sha256 || '').toLowerCase();
  if (clientSha && serverSha && clientSha !== serverSha) {
    captureKycMessage('Offline replay CNI hash mismatch (client/server)', 'upload_failure', {
      sessionId: item.session_id,
      step: item.step,
      operation: 'offline_replay_capture_cni_hash_check',
      extra: { queue_item_id: item.id },
    });
    throw new SyncError('capture_cni_hash_mismatch_local_check', {
      code: 'HASH_MISMATCH',
      retryable: false,
      queueStatus: 'needs_reupload',
    });
  }

  await markCaptureAsPurged(item.step);
  await removeKycSyncItem(item.id);
}

async function uploadLiveness(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<LivenessPayload>(item.session_id, item.encrypted_payload);

  // Upload selfie document first (if present) so the backend has a SELFIE
  // doc for face matching when the liveness result is processed.
  if (payload.selfie_data_url) {
    try {
      const blob = dataUrlToBlob(payload.selfie_data_url);
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');
      formData.append('doc_type', 'SELFIE');
      const selfieRes = await fetchWithCorrelation('/api/v1/kyc/document/upload', {
        method: 'POST',
        body: formData,
      });
      if (!selfieRes.ok) {
        captureKycMessage('Offline replay: selfie upload failed, liveness will proceed without face match', 'upload_failure', {
          sessionId: item.session_id,
          step: 'liveness',
          operation: 'offline_replay_selfie_upload',
          extra: { queue_item_id: item.id, status: selfieRes.status },
        });
        // Non-fatal: liveness submit can still succeed, just without face match
      }
    } catch (err) {
      captureKycException(err, 'upload_failure', {
        sessionId: item.session_id,
        step: 'liveness',
        operation: 'offline_replay_selfie_upload',
        extra: { queue_item_id: item.id },
      });
      // Non-fatal: continue with liveness submit
    }
  }

  // Submit liveness result (landmarks + challenge)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { selfie_data_url: _selfieDataUrl, ...livenessBody } = payload;
  const response = await fetchWithCorrelation('/api/v1/kyc/capture/liveness', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(livenessBody),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'capture_liveness', detail);
  }
  await removeKycSyncItem(item.id);
}

async function submitAddress(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<AddressPayload>(item.session_id, item.encrypted_payload);
  const response = await fetchWithCorrelation('/api/v1/kyc/address/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'submit_address', detail);
  }
  await removeKycSyncItem(item.id);
}

async function submitBill(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<BillPayload>(item.session_id, item.encrypted_payload);
  const formData = new FormData();
  formData.append('file', dataUrlToBlob(payload.file_data_url), `bill_${payload.bill_type.toLowerCase()}.jpg`);
  formData.append('bill_type', payload.bill_type);
  if (payload.session_id) {
    formData.append('session_id', payload.session_id);
  }
  if (payload.client_sha256) {
    formData.append('client_sha256', payload.client_sha256);
  }
  const response = await fetchWithCorrelation('/api/v1/kyc/capture/bill', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'submit_bill', detail);
  }
  await removeKycSyncItem(item.id);
}

async function submitNiu(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<NiuPayload>(item.session_id, item.encrypted_payload);
  const response = await fetchWithCorrelation('/api/v1/kyc/niu/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'submit_niu', detail);
  }
  await removeKycSyncItem(item.id);
}

async function submitConsent(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<ConsentPayload>(item.session_id, item.encrypted_payload);
  const response = await fetchWithCorrelation('/api/v1/kyc/consent/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cgu_accepted: payload.cgu_accepted,
      privacy_accepted: payload.privacy_accepted,
      data_processing_accepted: payload.data_processing_accepted,
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'submit_consent', detail);
  }
  await removeKycSyncItem(item.id);
}

async function submitSignature(item: KycSyncQueueItem): Promise<void> {
  const payload = await decryptJsonPayload<SignaturePayload>(item.session_id, item.encrypted_payload);
  const response = await fetchWithCorrelation('/api/v1/kyc/signature/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signature_data: payload.signature_data }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw classifyHttpSyncError(response.status, 'submit_signature', detail);
  }
  await removeKycSyncItem(item.id);
}

function sortQueueForReplay(queue: KycSyncQueueItem[]): KycSyncQueueItem[] {
  return [...queue].sort((a, b) => {
    const stepCmp = (STEP_PRIORITY[a.step] ?? 999) - (STEP_PRIORITY[b.step] ?? 999);
    if (stepCmp !== 0) return stepCmp;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function hasPendingCniDependency(item: KycSyncQueueItem, queue: KycSyncQueueItem[]): boolean {
  if (item.op_type !== 'capture_liveness') return false;
  return queue.some((q) =>
    q.session_id === item.session_id &&
    q.op_type === 'capture_cni' &&
    (q.status === 'pending' || q.status === 'needs_reupload' || q.status === 'failed'),
  );
}

async function processQueueItem(item: KycSyncQueueItem): Promise<void> {
  switch (item.op_type) {
    case 'capture_cni':
      await uploadCni(item);
      break;
    case 'capture_liveness':
      await uploadLiveness(item);
      break;
    case 'submit_address':
      await submitAddress(item);
      break;
    case 'submit_bill':
      await submitBill(item);
      break;
    case 'submit_niu':
      await submitNiu(item);
      break;
    case 'submit_consent':
      await submitConsent(item);
      break;
    case 'submit_signature':
      await submitSignature(item);
      break;
    default:
      captureKycMessage(`Unknown queue op_type: ${item.op_type}`, 'sync_error', {
        sessionId: item.session_id,
        step: item.step,
        operation: 'process_queue_item',
      });
  }
}

export async function runKycSyncNow(): Promise<void> {
  if (inFlight) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  inFlight = true;
  try {
    let queue = await loadKycSyncQueue();
    if (queue.length > 0) {
      await ensureServerDraftSession();
      queue = await loadKycSyncQueue();
    }
    const now = Date.now();
    for (const item of sortQueueForReplay(queue)) {
      if (item.status !== 'pending') continue;
      if (item.next_retry_at && new Date(item.next_retry_at).getTime() > now) continue;
      if (hasPendingCniDependency(item, queue)) {
        await updateKycSyncItem(item.id, {
          status: 'pending',
          last_error: 'WAITING_FOR_CNI_SYNC',
        });
        continue;
      }
      try {
        await processQueueItem(item);
      } catch (error: unknown) {
        const operationLabel = `offline_replay_${item.op_type}`;
        captureKycException(error, 'upload_failure', {
          sessionId: item.session_id,
          step: item.step,
          operation: operationLabel,
          extra: { queue_item_id: item.id, retry_count: item.retry_count },
        });
        const syncErr = error instanceof SyncError ? error : null;
        const networkLike = isNetworkLikeError(error);
        const retryCount = item.retry_count + 1;
        const canRetry = syncErr ? syncErr.retryable : (networkLike || retryCount <= RETRY_DELAYS_SECONDS.length);
        const targetStatus = syncErr ? syncErr.queueStatus : (canRetry ? 'pending' : 'failed');
        const lastErrorCode = syncErr?.code ?? (error instanceof Error ? error.message : String(error));
        await updateKycSyncItem(item.id, {
          status: targetStatus,
          retry_count: retryCount,
          next_retry_at: targetStatus === 'pending' && canRetry ? nextRetryAt(item.retry_count) : null,
          last_error: lastErrorCode,
        });
      }
      queue = await loadKycSyncQueue();
    }
  } finally {
    inFlight = false;
  }
}

export async function enqueueOfflineCniCapture(input: {
  sessionId: string;
  side: 'RECTO' | 'VERSO';
  step: 'cni_recto' | 'cni_verso';
  fileDataUrl: string;
  clientSha256?: string | null;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'capture_cni',
    session_id: input.sessionId,
    step: input.step,
    client_sha256: input.clientSha256 ?? null,
    payload: {
      file_data_url: input.fileDataUrl,
      side: input.side,
      session_id: input.sessionId,
      client_sha256: input.clientSha256 ?? null,
    } satisfies CniPayload,
    meta: { side: input.side },
  });
}

export async function enqueueOfflineLivenessCapture(input: {
  sessionId: string;
  challengeType: LivenessPayload['challenge_type'];
  landmarks: Array<Record<string, unknown>>;
  selfieDataUrl?: string;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'capture_liveness',
    session_id: input.sessionId,
    step: 'liveness',
    payload: {
      challenge_type: input.challengeType,
      landmarks_json: input.landmarks,
      ...(input.selfieDataUrl ? { selfie_data_url: input.selfieDataUrl } : {}),
    } satisfies LivenessPayload,
    meta: { challenge_type: input.challengeType },
  });
}

export async function enqueueOfflineAddress(input: {
  sessionId: string;
  address: AddressData;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'submit_address',
    session_id: input.sessionId,
    step: 'address',
    payload: input.address satisfies AddressPayload,
    meta: { region: input.address.region, city: input.address.city },
  });
}

export async function enqueueOfflineBill(input: {
  sessionId: string;
  billType: 'ENEO' | 'CAMWATER';
  fileDataUrl: string;
  clientSha256?: string | null;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'submit_bill',
    session_id: input.sessionId,
    step: 'utility_bill',
    client_sha256: input.clientSha256 ?? null,
    payload: {
      file_data_url: input.fileDataUrl,
      bill_type: input.billType,
      session_id: input.sessionId,
      client_sha256: input.clientSha256 ?? null,
    } satisfies BillPayload,
    meta: { bill_type: input.billType },
  });
}

export async function enqueueOfflineNiu(input: {
  sessionId: string;
  niuType: string;
  niuValue?: string | null;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'submit_niu',
    session_id: input.sessionId,
    step: 'niu',
    payload: {
      niu_type: input.niuType,
      niu_value: input.niuValue ?? null,
    } satisfies NiuPayload,
    meta: { niu_type: input.niuType },
  });
}

export async function enqueueOfflineConsent(input: {
  sessionId: string;
  cguAccepted: boolean;
  privacyAccepted: boolean;
  dataProcessingAccepted: boolean;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'submit_consent',
    session_id: input.sessionId,
    step: 'consent',
    payload: {
      cgu_accepted: input.cguAccepted,
      privacy_accepted: input.privacyAccepted,
      data_processing_accepted: input.dataProcessingAccepted,
    } satisfies ConsentPayload,
    meta: { cgu_accepted: String(input.cguAccepted) },
  });
}

export async function enqueueOfflineSignature(input: {
  sessionId: string;
  signatureData: string;
}): Promise<void> {
  await enqueueKycSyncItem({
    op_type: 'submit_signature',
    session_id: input.sessionId,
    step: 'signature',
    payload: {
      signature_data: input.signatureData,
    } satisfies SignaturePayload,
  });
}

export async function getKycSyncSummary(): Promise<QueueSummary> {
  const queue = await loadKycSyncQueue();
  const pendingCount = queue.filter((item) => item.status === 'pending').length;
  const needsReuploadCount = queue.filter((item) => item.status === 'needs_reupload').length;
  const failedCount = queue.filter((item) => item.status === 'failed').length;
  const state = await loadPersistedKycState();
  const hasResumeData = Boolean(
    state &&
      (state.sessionId !== null || (state.completedSteps && state.completedSteps.length > 0)) &&
      firstIncompleteStep(state.completedSteps || []) !== 'submission'
  );
  return { pendingCount, needsReuploadCount, failedCount, hasResumeData };
}

export async function getResumeTargetPath(): Promise<string | null> {
  const queue = await loadKycSyncQueue();
  const reupload = queue.find((item) => item.status === 'needs_reupload' && item.op_type === 'capture_cni');
  if (reupload && reupload.meta?.side === 'RECTO') return '/kyc/cni-recto-capture';
  if (reupload && reupload.meta?.side === 'VERSO') return '/kyc/cni-verso-capture';

  const state = await loadPersistedKycState();
  if (!state) return null;
  if (state.sessionId === null && (!state.completedSteps || state.completedSteps.length === 0)) return null;

  switch (firstIncompleteStep(state.completedSteps || [])) {
    case 'cni_recto':
      return '/kyc/cni-recto-guide';
    case 'cni_verso':
      return '/kyc/cni-verso-guide';
    case 'ocr_review':
      return '/kyc/ocr-review';
    case 'liveness':
      return '/kyc/liveness';
    case 'address':
      return '/kyc/address';
    case 'niu':
      return '/kyc/niu';
    case 'consent':
      return '/kyc/consent';
    case 'signature':
      return '/kyc/signature';
    case 'utility_bill':
      return '/kyc/bill-select';
    case 'submission':
    default:
      return null;
  }
}

export async function safeSubmitLiveness(payload: {
  landmarks_json: Array<Record<string, unknown>>;
  challenge_type: LivenessPayload['challenge_type'];
}): Promise<LivenessResult> {
  return await apiClient.post<LivenessResult, typeof payload>('/kyc/capture/liveness', payload);
}

export async function getSubmissionBlockerStatus(): Promise<SubmissionBlockerStatus> {
  const queue = await loadKycSyncQueue();
  const criticalQueue = queue.filter((item) =>
    item.op_type === 'capture_cni' || item.op_type === 'capture_liveness',
  );
  const pendingCriticalCount = criticalQueue.filter((item) => item.status === 'pending').length;
  const needsReuploadCount = criticalQueue.filter((item) => item.status === 'needs_reupload').length;
  const failedCount = criticalQueue.filter((item) => item.status === 'failed').length;
  const actionRequiredCount = needsReuploadCount + failedCount;

  if (needsReuploadCount > 0) {
    return {
      canSubmit: false,
      blockingReason: 'Certaines captures doivent etre reimportées avant soumission.',
      pendingCriticalCount,
      actionRequiredCount,
    };
  }
  if (failedCount > 0) {
    return {
      canSubmit: false,
      blockingReason: 'Certaines synchronisations ont echoue. Reessayez avant soumission.',
      pendingCriticalCount,
      actionRequiredCount,
    };
  }
  if (pendingCriticalCount > 0) {
    return {
      canSubmit: false,
      blockingReason: 'Synchronisation KYC en cours. Patientez avant soumission.',
      pendingCriticalCount,
      actionRequiredCount,
    };
  }
  return {
    canSubmit: true,
    blockingReason: null,
    pendingCriticalCount: 0,
    actionRequiredCount: 0,
  };
}
