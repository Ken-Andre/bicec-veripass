import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentChoiceScreen from './DocumentChoiceScreen';

const mockNavigate = vi.fn();
const mockSetDocumentChoice = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../contexts/KycContext', () => ({
  useKyc: () => ({
    documentChoice: null,
    setDocumentChoice: mockSetDocumentChoice,
  }),
}));

describe('DocumentChoiceScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows passport and driver license as disabled', () => {
    render(
      <MemoryRouter>
        <DocumentChoiceScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('Passeport').closest('button')).toBeDisabled();
    expect(screen.getByText('Permis de conduire').closest('button')).toBeDisabled();
  });

  it('continues with CNI + Cameroun only', () => {
    render(
      <MemoryRouter>
        <DocumentChoiceScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Continuer vers la capture CNI'));

    expect(mockSetDocumentChoice).toHaveBeenCalledWith({
      documentType: 'CNI',
      nationality: 'CM',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/kyc/cni-intro');
  });
});

