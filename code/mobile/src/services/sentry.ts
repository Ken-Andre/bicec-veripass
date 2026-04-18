import * as Sentry from '@sentry/react';

type KycEventName =
  | 'ocr_failure'
  | 'match_error'
  | 'upload_failure'
  | 'liveness_failure'
  | 'camera_error';

interface KycErrorContext {
  sessionId?: string | null;
  step?: string;
  role?: string;
  operation?: string;
  extra?: Record<string, unknown>;
}

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
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
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
