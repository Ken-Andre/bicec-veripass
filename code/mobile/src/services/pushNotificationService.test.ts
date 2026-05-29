import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('./apiClient', () => ({
  apiClient: {
    post: mockPost,
    get: mockGet,
    delete: mockDelete,
  },
}));

describe('pushNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('deactivates the matching server subscription when push is disabled', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = { endpoint: 'https://push.example/sub/1', unsubscribe };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(subscription),
          },
        }),
      },
    });
    localStorage.setItem('vp_push_subscription_id', 'sub-1');
    localStorage.setItem('vp_push_enabled', 'true');
    mockGet.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example/sub/1', is_active: true },
    ]);

    const { disablePushNotifications } = await import('./pushNotificationService');
    await disablePushNotifications();

    expect(unsubscribe).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith('/notifications/subscriptions');
    expect(mockDelete).toHaveBeenCalledWith('/notifications/subscriptions/sub-1');
    expect(localStorage.getItem('vp_push_subscription_id')).toBeNull();
    expect(localStorage.getItem('vp_push_enabled')).toBeNull();
  });

  it('stores the server subscription id after successful enablement', async () => {
    const browserSubscription = {
      endpoint: 'https://push.example/sub/2',
      toJSON: () => ({
        endpoint: 'https://push.example/sub/2',
        keys: { p256dh: 'client-key', auth: 'auth-secret' },
      }),
    };
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { requestPermission: vi.fn().mockResolvedValue('granted') },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(browserSubscription),
          },
        }),
      },
    });
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: vi.fn(),
    });
    mockPost.mockResolvedValue({ id: 'sub-2', endpoint: 'https://push.example/sub/2', is_active: true });
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'QUFB');

    const { enablePushNotifications } = await import('./pushNotificationService');
    const result = await enablePushNotifications();

    expect(result).toEqual(expect.objectContaining({ enabled: true, code: 'enabled' }));
    expect(mockPost).toHaveBeenCalledWith('/notifications/subscriptions', expect.objectContaining({
      endpoint: 'https://push.example/sub/2',
      keys: { p256dh: 'client-key', auth: 'auth-secret' },
    }));
    expect(localStorage.getItem('vp_push_subscription_id')).toBe('sub-2');
    expect(localStorage.getItem('vp_push_enabled')).toBe('true');
  });
});
