// TODO INFRA-02 intégration : pointer vers FastAPI backend sur :8000

export interface ApiError extends Error {
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

async function handleResponse(response: Response): Promise<any> {
  if (response.status === 401) {
    // JWT expired or invalid — clear token and trigger handler
    localStorage.removeItem('vp_token');
    if (_onSessionExpired) {
      _onSessionExpired();
    }
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore JSON parse error
    }
    const error = new Error(
      errorData.detail || response.statusText || `HTTP ${response.status}`
    ) as ApiError;
    error.response = { data: errorData };
    throw error;
  }

  // 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const createApiClient = (baseUrl: string) => {
  const getHeaders = (extraHeaders?: Record<string, string>) => {
    const token = localStorage.getItem('vp_token');
    return {
      'Content-Type': 'application/json',
      'X-Correlation-ID': generateCorrelationId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      return handleResponse(response);
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
      return handleResponse(response);
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
      return handleResponse(response);
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
      return handleResponse(response);
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
  const token = localStorage.getItem('vp_token');
  const headers = new Headers(init.headers);

  if (!headers.has('X-Correlation-ID')) {
    headers.set('X-Correlation-ID', generateCorrelationId());
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}

export const apiClient = createApiClient('/api/v1');
