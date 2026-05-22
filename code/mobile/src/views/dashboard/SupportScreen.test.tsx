import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SupportScreen } from './SupportScreen';

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockFetchWithCorrelation = vi.hoisted(() => vi.fn());
const onePagePdf = '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF';
const sixPagePdf = '%PDF-1.4\n' + Array.from({ length: 6 }, (_, index) => `${index + 1} 0 obj\n<< /Type /Page >>\nendobj`).join('\n') + '\n%%EOF';

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
  fetchWithCorrelation: mockFetchWithCorrelation,
}));

describe('SupportScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        subtle: {
          digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
        },
      },
      configurable: true,
    });
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

  it('shows attachment limits and sends a valid file through the support thread', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([]);
    mockFetchWithCorrelation.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'm3',
        thread_id: 'thread-1',
        sender: 'user',
        content: 'Document demande',
        attachment_filename: 'justificatif.pdf',
        attachment_sha256: '01020304',
        attachment_path: '/data/documents/support/user/justificatif.pdf',
        created_at: '2026-05-21T10:03:00.000Z',
      }),
    });

    const { container } = render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    await screen.findByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([onePagePdf], 'justificatif.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.change(await screen.findByPlaceholderText(/Ajouter un message optionnel/i), {
      target: { value: 'Document demande' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    await waitFor(() => {
      expect(mockFetchWithCorrelation).toHaveBeenCalledWith(
        '/api/v1/support/threads/thread-1/attachments',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
      expect(screen.getByText('justificatif.pdf')).toBeInTheDocument();
    });
  });

  it('blocks unsupported or oversized attachments before upload', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([]);

    const { container } = render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    await screen.findByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['x'], 'script.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(await screen.findByText(/Format non supporte/i)).toBeInTheDocument();
    expect(mockFetchWithCorrelation).not.toHaveBeenCalled();
  });

  it('blocks PDF attachments over the page limit before upload', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([]);

    const { container } = render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    await screen.findByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File([sixPagePdf], 'long.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByText(/PDF trop long.*5 pages/i)).toBeInTheDocument();
    expect(mockFetchWithCorrelation).not.toHaveBeenCalled();
  });

  it('blocks images over the support image limit before upload', async () => {
    mockGet
      .mockResolvedValueOnce({ id: 'thread-1' })
      .mockResolvedValueOnce([]);

    const { container } = render(
      <MemoryRouter>
        <SupportScreen />
      </MemoryRouter>,
    );

    await screen.findByText(/JPG\/PNG 4 Mo max - PDF 6 Mo, 5 pages max/i);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversizedImage = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [oversizedImage] } });

    expect(await screen.findByText(/Image trop volumineuse.*4 Mo/i)).toBeInTheDocument();
    expect(mockFetchWithCorrelation).not.toHaveBeenCalled();
  });
});
