import * as Sentry from '@sentry/react';

// Sentry proxy endpoint — routes through our API to bypass ad-blocker blacklists
// The ingest domain (o4511113586409472.ingest.de.sentry.io) is blocked by uBlock Origin, Brave...
const SENTRY_PROXY_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/sentry-proxy`
  : '/api/v1/sentry-proxy';

export function getSentryProjectFromTransportUrl(transportUrl: string): string {
  try {
    const url = new URL(transportUrl);
    return url.pathname.split('/').filter(Boolean).at(-2) || '';
  } catch {
    return '';
  }
}

export function initBackofficeSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const isProd = import.meta.env.MODE === 'production';

  // Custom transport that sends to our proxy instead of Sentry directly.
  // The Sentry ingest domain is blocked by ad-blockers; we route through our backend.
  const makeProxyTransport = (transportOptions: { url: string } & Parameters<typeof Sentry.createTransport>[0]) =>
    Sentry.createTransport(transportOptions, (request) => {
      const url = new URL(transportOptions.url);
      const sentryKey = url.searchParams.get('sentry_key') || '';
      const sentryVersion = url.searchParams.get('sentry_version') || '7';
      const sentryClient = url.searchParams.get('sentry_client') || '';
      const sentryProject = getSentryProjectFromTransportUrl(transportOptions.url);

      const proxyUrl = new URL(SENTRY_PROXY_URL, window.location.origin);
      proxyUrl.searchParams.set('sentry_key', sentryKey);
      proxyUrl.searchParams.set('sentry_version', sentryVersion);
      proxyUrl.searchParams.set('sentry_client', sentryClient);
      proxyUrl.searchParams.set('sentry_project', sentryProject);

      const bodyStr = typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);

      return fetch(proxyUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: bodyStr,
        credentials: 'omit',
        signal: controller.signal,
      })
        .then((response) => {
          clearTimeout(timeoutId);
          return { statusCode: response.status === 202 ? 200 : response.status };
        })
        .catch(() => {
          clearTimeout(timeoutId);
          return { statusCode: 200 };
        }); // Drop silently if proxy is unreachable
    });

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    transport: makeProxyTransport as Parameters<typeof Sentry.init>[0]['transport'],
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
