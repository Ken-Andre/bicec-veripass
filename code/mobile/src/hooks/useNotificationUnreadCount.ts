/**
 * Hook partagé pour le compteur de notifications non lues.
 *
 * Source unique de vérité : cache TanStack Query (`notifications-list`).
 * Le badge du Dashboard, l'écran de notifications et tout composant
 * consommateur partagent le même cache — marquer comme lu invalide
 * automatiquement le compteur sans état désynchronisé.
 *
 * Pourquoi TanStack Query : la valeur change côté backend (nouvelles
 * notifications) et côté client (marquage local). Un compteur hardcodé
 * était la source du bug « badge 2 affiché en permanence ».
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { getAuthToken } from '../services/authTokenStorage';
import type { NotificationListResponse } from '../types';

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'] as const;
const POLL_INTERVAL_MS = 30_000;

async function fetchNotifications(): Promise<NotificationListResponse> {
  return apiClient.get<NotificationListResponse>('/notifications');
}

export function useNotificationsQuery() {
  const token = getAuthToken();
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    enabled: Boolean(token),
    staleTime: 15_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationUnreadCount(): number {
  const { isAuthenticated } = useAuth();
  const query = useNotificationsQuery();
  if (!isAuthenticated) return 0;
  return query.data?.unread_count ?? 0;
}

export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
}

export function useMarkNotificationsRead() {
  const invalidate = useInvalidateNotifications();

  return async () => {
    await apiClient.post('/notifications/read', { mark_all: true });
    invalidate();
  };
}

/**
 * Polling léger qui ne s'exécute que si l'utilisateur est authentifié.
 * Utile pour les écrans qui n'utilisent pas TanStack Query directement
 * mais veulent garder le compteur frais (ex: BottomNav).
 */
export function useNotificationsPolling() {
  const { isAuthenticated } = useAuth();
  const query = useNotificationsQuery();
  useEffect(() => {
    if (!isAuthenticated) return;
    if (query.error) {
      console.warn('[notifications] poll failed', query.error);
    }
  }, [isAuthenticated, query.error]);
}
