import { apiClient } from './apiClient';

interface PushSubscriptionResponse {
  id: string;
  endpoint: string;
  device_tag?: string | null;
  is_active: boolean;
}

async function getReadyServiceWorker(timeoutMs = 2000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function enablePushNotifications(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) return false;

  const registration = await getReadyServiceWorker();
  if (!registration) return false;
  const existing = await registration.pushManager.getSubscription();
  const applicationServerKey = urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer;
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const saved = await apiClient.post<PushSubscriptionResponse, {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    user_agent: string;
    device_tag: string | null;
  }>('/notifications/subscriptions', {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    user_agent: navigator.userAgent,
    device_tag: localStorage.getItem('vp_device_tag'),
  });

  localStorage.setItem('vp_push_subscription_id', saved.id);
  localStorage.setItem('vp_push_enabled', 'true');
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  let endpoint: string | null = null;
  {
    const registration = await getReadyServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint ?? null;
    await subscription?.unsubscribe();
  }

  try {
    const subscriptions = await apiClient.get<PushSubscriptionResponse[]>('/notifications/subscriptions');
    const storedId = localStorage.getItem('vp_push_subscription_id');
    const matching = subscriptions.find((item) => item.id === storedId || item.endpoint === endpoint);
    if (matching) {
      await apiClient.delete(`/notifications/subscriptions/${matching.id}`);
    }
  } catch {
    // Local opt-out must still complete if the server is temporarily unavailable.
  }

  localStorage.removeItem('vp_push_subscription_id');
  localStorage.removeItem('vp_push_enabled');
}
