import * as Sentry from '@sentry/react';

export function initBackofficeSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const isProd = import.meta.env.MODE === 'production';
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 0,
    environment: import.meta.env.MODE,
    release: `veripass-backoffice@${import.meta.env.VITE_APP_VERSION || '0.1.0'}`,
    beforeSend(event) {
      if (!isProd) return null;
      return event;
    },
  });
}
