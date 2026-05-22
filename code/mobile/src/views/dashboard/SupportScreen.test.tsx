import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SupportScreen } from './SupportScreen';

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      'support.title': 'Support',
      'support.empty': 'Aucun message',
      'support.placeholder': 'Votre message',
    }[key] || key),
  }),
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
}));

describe('SupportScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current thread and its messages from the real support API contract', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([
        {
          id: 'm1',
          thread_id: 'thread-1',
          sender: 'agent',
          content: 'Bonjour Marie',
          created_at: '2026-05-21T10:00:00.000Z',
        },
      ]);

    render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenNthCalledWith(1, '/support/threads/current');
      expect(mockGet).toHaveBeenNthCalledWith(2, '/support/threads/thread-1/messages');
      expect(screen.getByText('Bonjour Marie')).toBeInTheDocument();
    });
  });

  it('sends messages to the current support thread', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([]);
    mockPost.mockResolvedValue({
      id: 'm2',
      thread_id: 'thread-1',
      sender: 'user',
      content: 'Voici le fichier.',
      created_at: '2026-05-21T10:02:00.000Z',
    });

    render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    const input = await screen.findByPlaceholderText('Votre message');
    fireEvent.change(input, { target: { value: 'Voici le fichier.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/support/threads/thread-1/messages', {
        content: 'Voici le fichier.',
      });
    });
  });
});
