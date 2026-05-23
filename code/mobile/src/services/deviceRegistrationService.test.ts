import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());

vi.mock('./apiClient', () => ({
  apiClient: {
    post: mockPost,
  },
}));

describe('deviceRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('registers a privacy-reduced device fingerprint and stores the returned tag', async () => {
    const { ensureDeviceRegistered } = await import('./deviceRegistrationService');
    mockPost.mockResolvedValue({ device_tag: 'vp_dev_123' });

    const tag = await ensureDeviceRegistered();

    expect(tag).toBe('vp_dev_123');
    expect(localStorage.getItem('vp_device_tag')).toBe('vp_dev_123');
    expect(mockPost).toHaveBeenCalledWith(
      '/devices/register',
      expect.objectContaining({
        fingerprint_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        metadata: expect.objectContaining({
          language: expect.any(String),
          screen: expect.any(Object),
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Device-Fingerprint': expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('keeps the same fingerprint while the local device seed is stable', async () => {
    const { buildDeviceFingerprintHash } = await import('./deviceRegistrationService');

    const first = await buildDeviceFingerprintHash();
    const second = await buildDeviceFingerprintHash();

    expect(first).toBe(second);
    expect(localStorage.getItem('vp_device_seed')).toBeTruthy();
  });
});
