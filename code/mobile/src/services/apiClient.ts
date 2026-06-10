// TODO INFRA-02 intégration : pointer vers FastAPI backend sur :8000

import { clearAuthToken, getAuthToken } from './authTokenStorage';

export interface ApiError extends Error {
  status?: number;
  response?: {
    data: unknown;
  };
}

// Global session expired callback — set by AuthContext on mount
let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  _onSessionExpired = handler;
}

// ---------------------------------------------------------------------------
// X-Correlation-ID — unique per request for distributed tracing
// ---------------------------------------------------------------------------
function generateCorrelationId(): string {
  // Format: vp-<timestamp_hex>-<8 random hex chars>
  const ts = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `vp-${ts}-${rand}`;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number; // ms, default 15000 (15s)
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // JWT expired or invalid — clear token and trigger handler
    clearAuthToken();
    if (_onSessionExpired) {
      _onSessionExpired();
    }
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore JSON parse error
    }
    const error = new Error(
      (errorData.detail as string) || response.statusText || `HTTP ${response.status}`
    ) as ApiError;
    error.status = response.status;
    error.response = { data: errorData };
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const createApiClient = (baseUrl: string) => {
  const getHeaders = (extraHeaders?: Record<string, string>) => {
    const token = getAuthToken();
    const deviceTag = localStorage.getItem('vp_device_tag');
    return {
      'Content-Type': 'application/json',
      'X-Correlation-ID': generateCorrelationId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceTag ? { 'X-Device-Tag': deviceTag } : {}),
      ...extraHeaders,
    };
  };

  return {
    get: async <T>(
      path: string,
      options?: RequestOptions
    ): Promise<T> => {
      const response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          headers: getHeaders(options?.headers),
        },
        options?.timeout ?? 15000
      );
      return handleResponse<T>(response);
    },

    post: async <T, D>(
      path: string,
      data: D,
      options?: RequestOptions
    ): Promise<T> => {
      // Extended default timeout for OCR and liveness endpoints
      const isOcr = path.includes('/ocr/');
      const isLiveness = path.includes('/liveness');
      const defaultTimeout = isOcr ? 90000 : isLiveness ? 60000 : 15000;

      const response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          method: 'POST',
          headers: getHeaders(options?.headers),
          body: JSON.stringify(data),
        },
        options?.timeout ?? defaultTimeout
      );
      return handleResponse<T>(response);
    },

    put: async <T, D>(
      path: string,
      data: D,
      options?: RequestOptions
    ): Promise<T> => {
      const response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          method: 'PUT',
          headers: getHeaders(options?.headers),
          body: JSON.stringify(data),
        },
        options?.timeout ?? 15000
      );
      return handleResponse<T>(response);
    },

    delete: async <T>(
      path: string,
      options?: RequestOptions
    ): Promise<T> => {
      const response = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
          method: 'DELETE',
          headers: getHeaders(options?.headers),
        },
        options?.timeout ?? 15000
      );
      return handleResponse<T>(response);
    },
  };
};

/**
 * Fetch wrapper that injects X-Correlation-ID and Authorization headers
 * into raw fetch() calls (used by screens that upload FormData, etc.).
 */
export function fetchWithCorrelation(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);

  if (!headers.has('X-Correlation-ID')) {
    headers.set('X-Correlation-ID', generateCorrelationId());
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const deviceTag = localStorage.getItem('vp_device_tag');
  if (deviceTag && !headers.has('X-Device-Tag')) {
    headers.set('X-Device-Tag', deviceTag);
  }

  return fetch(url, { ...init, headers }).then((response) => {
    if (response.status === 401) {
      clearAuthToken();
      if (_onSessionExpired) {
        _onSessionExpired();
      }
    }
    return response;
  });
}

export const apiClient = createApiClient('/api/v1');
