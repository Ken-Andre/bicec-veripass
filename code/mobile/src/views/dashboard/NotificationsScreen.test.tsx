import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsScreen } from './NotificationsScreen';

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'notifications.title': 'Notifications',
      'notifications.empty': 'Aucune notification',
    }[key] || key),
  }),
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
}));

describe('NotificationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads notifications from the real notifications API contract', async () => {
    mockGet.mockResolvedValue({
      unread_count: 1,
      items: [
        {
          id: 'n1',
          type: 'GENERAL',
          title: 'Compte',
          message: 'Votre dossier avance.',
          read: false,
          created_at: '2026-05-21T10:00:00.000Z',
        },
      ],
    });

    render(
      <MemoryRouter>
        <NotificationsScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/notifications');
      expect(screen.getByText('Compte')).toBeInTheDocument();
    });
  });

  it('marks all notifications as read through /notifications/read', async () => {
    mockGet.mockResolvedValue({
      unread_count: 1,
      items: [
        {
          id: 'n1',
          type: 'GENERAL',
          title: 'Compte',
          message: 'Votre dossier avance.',
          read: false,
          created_at: '2026-05-21T10:00:00.000Z',
        },
      ],
    });
    mockPost.mockResolvedValue({ marked_read: 1 });

    render(
      <MemoryRouter>
        <NotificationsScreen />
      </MemoryRouter>,
    );

    await screen.findByText('Tout marquer comme lu (1)');
    fireEvent.click(screen.getByText('Tout marquer comme lu (1)'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/notifications/read', { mark_all: true });
    });
  });
});
