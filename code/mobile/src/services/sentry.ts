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

export function initMobileSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const isProd = import.meta.env.MODE === 'production';

  // Custom transport that sends to our proxy instead of Sentry directly
  // This avoids tracking prevention blockers.
  // transport must be a factory: (BrowserTransportOptions) => Transport
  const makeProxyTransport = (transportOptions: { url: string } & Parameters<typeof Sentry.createTransport>[0]) =>
    Sentry.createTransport(transportOptions, (request) => {
      // Extract query params from the original URL
      const url = new URL(transportOptions.url);
      const sentryKey = url.searchParams.get('sentry_key') || '';
      const sentryVersion = url.searchParams.get('sentry_version') || '7';
      const sentryClient = url.searchParams.get('sentry_client') || '';

      // Build proxy URL with query params
      const proxyUrl = new URL(SENTRY_PROXY_URL);
      proxyUrl.searchParams.set('sentry_key', sentryKey);
      proxyUrl.searchParams.set('sentry_version', sentryVersion);
      proxyUrl.searchParams.set('sentry_client', sentryClient);

      const bodyStr = typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body);

      // Send to our backend proxy instead of Sentry
      return fetch(proxyUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
        },
        body: bodyStr,
        credentials: 'omit',
      }).then((response) => {
        return { statusCode: response.status };
      }).catch(() => {
        // Fallback: try sending directly if proxy fails
        return fetch(transportOptions.url, {
          method: 'POST',
          body: bodyStr,
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
          },
          credentials: 'omit',
        }).then((response) => ({ statusCode: response.status }));
      });
    });

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    transport: makeProxyTransport as Parameters<typeof Sentry.init>[0]['transport'],
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 0,
    environment: import.meta.env.MODE,
    release: `veripass-mobile@${import.meta.env.VITE_APP_VERSION || '0.1.0'}`,
    beforeSend(event) {
      if (!isProd) return null;
      return event;
    },
  });
}


export function captureKycException(
  error: unknown,
  eventName: KycEventName,
  ctx: KycErrorContext = {},
): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
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
  if (!import.meta.env.VITE_SENTRY_DSN) return;
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
