import { describe, expect, it } from 'vitest';
import { getSentryProjectFromTransportUrl } from './sentry';

describe('backoffice Sentry transport helpers', () => {
  it('extracts the project id from a Sentry envelope URL', () => {
    expect(
      getSentryProjectFromTransportUrl(
        'https://o4511113586409472.ingest.de.sentry.io/api/4511114014949456/envelope/?sentry_key=abc&sentry_version=7',
      ),
    ).toBe('4511114014949456');
  });

  it('returns an empty project id for invalid URLs', () => {
    expect(getSentryProjectFromTransportUrl('not a url')).toBe('');
  });
});
