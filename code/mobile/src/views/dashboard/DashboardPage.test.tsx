import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

const mockUseKyc = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/KycContext', () => ({
  useKyc: mockUseKyc,
}));

vi.mock('../../hooks/useNotificationUnreadCount', () => ({
  useNotificationUnreadCount: () => 0,
}));

describe('DashboardPage KYC state', () => {
  it('does not show the post-submission hero for a draft session flagged restricted', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'RESTRICTED',
      currentStep: 'cni_recto',
      completedSteps: [],
      reviewStatus: null,
      status: 'DRAFT',
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Votre dossier client')).toBeInTheDocument();
    expect(screen.getByText('Dossier complet')).toBeInTheDocument();
    expect(screen.queryByText('Merci pour votre confiance')).not.toBeInTheDocument();
  });

  it('shows the post-submission hero only after agent review starts', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'RESTRICTED',
      currentStep: 'submission',
      completedSteps: ['cni_recto', 'cni_verso', 'liveness', 'utility_bill', 'address', 'niu', 'consent', 'signature', 'ocr_review', 'submission'],
      reviewStatus: null,
      status: 'PENDING_AGENT_REVIEW',
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Merci pour votre confiance')).toBeInTheDocument();
  });
});
