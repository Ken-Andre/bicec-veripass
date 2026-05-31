import * as Sentry from '@sentry/react';

type KycEventName =
  | 'ocr_failure'
  | 'match_error'
  | 'upload_failure'
  | 'liveness_failure'
  | 'camera_error'
  | 'sync_error';

interface KycErrorContext {
  sessionId?: string | null;
  step?: string;
  role?: string;
  operation?: string;
  extra?: Record<string, unknown>;
}

const MOBILE_SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ??
  'https://1b4659211a1efab3936b4d3706dc9aa2@o4511113586409472.ingest.de.sentry.io/4511114011410512';

// Sentry proxy endpoint - avoids tracking prevention blockers
// Events are sent to our backend which forwards to Sentry server-side
const SENTRY_PROXY_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/sentry-proxy`
  : '/api/v1/sentry-proxy';

function safeUserRole(): string {
  try {
    const raw = localStorage.getItem('vp_user');
    if (!raw) return 'unknown';
    const parsed = JSON.parse(raw) as { role?: string };
    return parsed.role || 'unknown';
  } catch {
    return 'unknown';
  }
}

function eventText(event: Sentry.Event): string {
  const parts = [
    event.message,
    event.exception?.values?.map((value) => `${value.type || ''} ${value.value || ''}`).join(' '),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function shouldDropMobileSentryEventForNoise(event: Sentry.Event): boolean {
  const text = eventText(event);
  return [
    'failed to update a serviceworker',
    'unsupported mime type',
    'notallowederror: permission denied',
    'timeout starting video source',
    'signal is aborted without reason',
    'bill_upload_504_gateway_timeout',
    'bill_upload_client_timeout',
    'bill_capture_504_gateway_timeout',
    'bill_capture_client_timeout',
    'internal error',
  ].some((fragment) => text.includes(fragment));
}

export function initMobileSentry(): void {
  if (!MOBILE_SENTRY_DSN) return;

  const isProd = import.meta.env.MODE === 'production';

  // Custom transport that sends to our proxy instead of Sentry directly.
  // The Sentry ingest domain (o4511113586409472.ingest.de.sentry.io) is blocked by ad-blockers.
  // We route through our own backend (/api/v1/sentry-proxy) which forwards server-side.
  // transport must be a factory: (BrowserTransportOptions) => Transport
  const makeProxyTransport = (transportOptions: { url: string } & Parameters<typeof Sentry.createTransport>[0]) =>
    Sentry.createTransport(transportOptions, (request) => {
      // Extract query params from the original DSN-derived URL
      const url = new URL(transportOptions.url);
      const sentryKey = url.searchParams.get('sentry_key') || '';
      const sentryVersion = url.searchParams.get('sentry_version') || '7';
      const sentryClient = url.searchParams.get('sentry_client') || '';
      const sentryProject = url.pathname.split('/').filter(Boolean).at(-2) || '';

      // Build proxy URL — use relative path so it works regardless of VITE_API_URL at build time
      const proxyUrl = new URL(SENTRY_PROXY_URL, window.location.origin);
      proxyUrl.searchParams.set('sentry_key', sentryKey);
      proxyUrl.searchParams.set('sentry_version', sentryVersion);
      proxyUrl.searchParams.set('sentry_client', sentryClient);
      proxyUrl.searchParams.set('sentry_project', sentryProject);

      const bodyStr = typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body);

      // 5-second client-side timeout — the backend should respond 202 almost instantly
      // (actual Sentry forwarding happens in a FastAPI BackgroundTask after the response).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);

      // Send exclusively through our backend proxy — do NOT fall back to the blocked ingest domain.
      return fetch(proxyUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
        },
        body: bodyStr,
        credentials: 'omit',
        signal: controller.signal,
      })
        .then((response) => {
          clearTimeout(timeoutId);
          // 202 Accepted is our fire-and-forget success code
          return { statusCode: response.status === 202 ? 200 : response.status };
        })
        .catch(() => {
          clearTimeout(timeoutId);
          // Proxy unreachable, aborted, or network offline — drop silently
          return { statusCode: 200 };
        });
    });

  Sentry.init({
    dsn: MOBILE_SENTRY_DSN,
    sendDefaultPii: true,
    transport: makeProxyTransport as Parameters<typeof Sentry.init>[0]['transport'],
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: isProd ? 0.1 : 0,
    replaysSessionSampleRate: isProd ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: `veripass-mobile@${import.meta.env.VITE_APP_VERSION || '0.1.0'}`,
    beforeSend(event) {
      if (!isProd) return null;
      if (shouldDropMobileSentryEventForNoise(event)) return null;
      return event;
    },
  });
}


export function captureKycException(
  error: unknown,
  eventName: KycEventName,
  ctx: KycErrorContext = {},
): void {
  if (!MOBILE_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag('domain', 'kyc');
    scope.setTag('event_name', eventName);
    scope.setTag('step', ctx.step || 'unknown');
    scope.setTag('role', ctx.role || safeUserRole());
    scope.setTag('environment', import.meta.env.MODE);
    if (ctx.sessionId) {
      scope.setTag('session_id', ctx.sessionId);
    }
    if (ctx.operation) {
      scope.setTag('operation', ctx.operation);
    }
    if (ctx.extra) {
      scope.setContext('kyc_context', ctx.extra);
    }
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

export function captureKycMessage(
  message: string,
  eventName: KycEventName,
  ctx: KycErrorContext = {},
): void {
  if (!MOBILE_SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTag('domain', 'kyc');
    scope.setTag('event_name', eventName);
    scope.setTag('step', ctx.step || 'unknown');
    scope.setTag('role', ctx.role || safeUserRole());
    scope.setTag('environment', import.meta.env.MODE);
    if (ctx.sessionId) {
      scope.setTag('session_id', ctx.sessionId);
    }
    if (ctx.operation) {
      scope.setTag('operation', ctx.operation);
    }
    if (ctx.extra) {
      scope.setContext('kyc_context', ctx.extra);
    }
    Sentry.captureMessage(message, 'error');
  });
}
