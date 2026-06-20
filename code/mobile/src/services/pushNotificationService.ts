import { apiClient } from './apiClient';

interface PushSubscriptionResponse {
  id: string;
  endpoint: string;
  device_tag?: string | null;
  is_active: boolean;
}

export type PushEnableCode =
  | 'enabled'
  | 'unsupported'
  | 'permission_denied'
  | 'missing_vapid_key'
  | 'service_worker_unavailable'
  | 'subscription_failed'
  | 'server_unavailable';

export interface PushEnableResult {
  enabled: boolean;
  code: PushEnableCode;
  message: string;
}

function pushResult(code: PushEnableCode, message: string, enabled = false): PushEnableResult {
  return { enabled, code, message };
}

async function getReadyServiceWorker(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch (err) {
    console.warn('[push] getReadyServiceWorker failed', err);
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

export async function enablePushNotifications(): Promise<PushEnableResult> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] unsupported: Notification, serviceWorker, or PushManager missing');
    return pushResult('unsupported', "Les notifications push ne sont pas prises en charge sur cet appareil.");
  }

  // Vérifier la permission AVANT de la demander pour éviter un re-prompt inutile
  if (Notification.permission === 'denied') {
    console.warn('[push] permission previously denied by user');
    return pushResult('permission_denied', "Autorisation refusee. Activez les notifications dans les reglages de l'appareil.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[push] permission not granted:', permission);
    return pushResult('permission_denied', "Autorisation refusee. Activez les notifications dans les reglages de l'appareil.");
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set');
    return pushResult('missing_vapid_key', 'Configuration push indisponible. Reessayez plus tard.');
  }

  const registration = await getReadyServiceWorker();
  if (!registration) {
    console.warn('[push] service worker not ready after timeout');
    return pushResult('service_worker_unavailable', 'Service de notification indisponible. Rouvrez l application et reessayez.');
  }

  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    const applicationServerKey = urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer;
    subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : String(err);
    console.warn('[push] subscribe failed', { name, error: err });
    if (name === 'NotAllowedError') {
      return pushResult('permission_denied', 'Autorisation refusee par le navigateur.');
    }
    if (name === 'InvalidStateError') {
      return pushResult('subscription_failed', 'Abonnement deja existant dans un etat invalide.');
    }
    return pushResult('subscription_failed', 'Impossible de creer l abonnement push sur cet appareil.');
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    console.warn('[push] subscription incomplete', json);
    return pushResult('subscription_failed', 'Abonnement push incomplet. Reessayez.');
  }

  let saved: PushSubscriptionResponse;
  try {
    saved = await apiClient.post<PushSubscriptionResponse, {
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
  } catch (err) {
    const status = (err as { status?: number })?.status;
    console.warn('[push] POST /subscriptions failed', { status, error: err });
    if (status === 401) {
      // Nettoyer le localStorage si la session a expiré
      localStorage.removeItem('vp_push_subscription_id');
      localStorage.removeItem('vp_push_enabled');
      return pushResult('server_unavailable', 'Session expiree. Reconnectez-vous.');
    }
    return pushResult('server_unavailable', 'Autorisation acceptee, mais le service est temporairement indisponible.');
  }

  // localStorage APRÈS le succès de l'API (D5)
  localStorage.setItem('vp_push_subscription_id', saved.id);
  localStorage.setItem('vp_push_enabled', 'true');
  return pushResult('enabled', 'Notifications push activees.', true);
}

export async function disablePushNotifications(): Promise<void> {
  let endpoint: string | null = null;
  {
    const registration = await getReadyServiceWorker();
    const subscription = await registration?.pushManager.getSubscription();
    endpoint = subscription?.endpoint ?? null;
    try {
      await subscription?.unsubscribe();
    } catch (err) {
      console.warn('[push] unsubscribe failed', err);
    }
  }

  try {
    const subscriptions = await apiClient.get<PushSubscriptionResponse[]>('/notifications/subscriptions');
    const storedId = localStorage.getItem('vp_push_subscription_id');
    const matching = subscriptions.find((item) => item.id === storedId || item.endpoint === endpoint);
    if (matching) {
      await apiClient.delete(`/notifications/subscriptions/${matching.id}`);
    }
  } catch (err) {
    console.warn('[push] disablePushNotifications API cleanup failed', err);
  }

  localStorage.removeItem('vp_push_subscription_id');
  localStorage.removeItem('vp_push_enabled');
}
