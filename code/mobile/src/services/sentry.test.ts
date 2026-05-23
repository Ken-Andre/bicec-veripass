import { describe, expect, it } from 'vitest';
import { shouldDropMobileSentryEventForNoise } from './sentry';

describe('mobile Sentry noise filtering', () => {
  it('drops expected service worker update failures', () => {
    expect(
      shouldDropMobileSentryEventForNoise({
        exception: {
          values: [
            {
              type: 'Error',
              value: "SecurityError: Failed to update a ServiceWorker for scope ('https://localhost/mobile/') with script ('https://localhost/mobile/sw.js'): The script has an unsupported MIME type ('text/html').",
            },
          ],
        },
      } as never),
    ).toBe(true);
  });

  it('drops expected camera permission and abort noise', () => {
    expect(
      shouldDropMobileSentryEventForNoise({
        exception: { values: [{ type: 'Error', value: 'NotAllowedError: Permission denied' }] },
      } as never),
    ).toBe(true);
    expect(
      shouldDropMobileSentryEventForNoise({
        exception: { values: [{ type: 'AbortError', value: 'signal is aborted without reason' }] },
      } as never),
    ).toBe(true);
  });

  it('keeps unknown runtime failures', () => {
    expect(
      shouldDropMobileSentryEventForNoise({
        exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] },
      } as never),
    ).toBe(false);
  });
});
