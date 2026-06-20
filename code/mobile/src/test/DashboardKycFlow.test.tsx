import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../views/dashboard/DashboardPage';

// Mock des hooks
const mockUseKyc = vi.fn();
const mockUseNotificationUnreadCount = vi.fn();

vi.mock('../contexts/KycContext', () => ({
  useKyc: () => mockUseKyc(),
}));

vi.mock('../hooks/useNotificationUnreadCount', () => ({
  useNotificationUnreadCount: () => mockUseNotificationUnreadCount(),
}));

vi.mock('../components/KycResumeBanner', () => ({
  KycResumeBanner: () => null,
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage — non-régression KYC flow', () => {
  beforeEach(() => {
    mockUseNotificationUnreadCount.mockReturnValue(0);
  });

  it('DRAFT + RESTRICTED : n\'affiche JAMAIS "Merci pour votre confiance" (bug initial)', () => {
    // Ancien bug : DRAFT créé avec accessLevel=RESTRICTED → DashboardPage
    // interprétait RESTRICTED comme "dossier soumis en revue" et affichait
    // "Merci pour votre confiance" pour un user qui n'a jamais commencé.
    // Fix : isUnderReview exclut status='DRAFT'.
    mockUseKyc.mockReturnValue({
      accessLevel: 'RESTRICTED',
      status: 'DRAFT',
      currentStep: 'cni_recto',
      completedSteps: [],
      reviewStatus: null,
    });
    renderDashboard();

    // Anti-régression : la bannière "Merci pour votre confiance" ne doit JAMAIS
    // apparaître pour un user en DRAFT, quel que soit accessLevel.
    expect(screen.queryByText(/merci pour votre confiance/i)).not.toBeInTheDocument();
    // Le hero montre le parcours KYC normal
    expect(screen.getByText(/votre dossier client/i)).toBeInTheDocument();
  });

  it('DRAFT + GUEST : cas nominal pour un nouveau user, affiche "Dossier à compléter"', () => {
    // Avec le fix backend (DRAFT → GUEST), un nouveau user a accessLevel=GUEST
    // et l'access card affiche "Dossier à compléter".
    mockUseKyc.mockReturnValue({
      accessLevel: 'GUEST',
      status: 'DRAFT',
      currentStep: 'cni_recto',
      completedSteps: [],
      reviewStatus: null,
    });
    renderDashboard();

    expect(screen.queryByText(/merci pour votre confiance/i)).not.toBeInTheDocument();
    expect(screen.getByText(/dossier à compléter/i)).toBeInTheDocument();
    expect(screen.getByText(/votre dossier client/i)).toBeInTheDocument();
  });

  it('SUBMITTED + RESTRICTED : affiche "Dossier soumis" (KYC transmis)', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'RESTRICTED',
      status: 'SUBMITTED',
      currentStep: 'submission',
      completedSteps: ['cni_recto', 'cni_verso', 'liveness', 'utility_bill', 'address', 'niu', 'consent', 'signature', 'ocr_review', 'submission'],
      reviewStatus: { status: 'SUBMITTED' },
    });
    renderDashboard();

    expect(screen.getByText(/dossier soumis/i)).toBeInTheDocument();
    // Plus de bouton CTA vers une prochaine étape (toutes les étapes sont faites)
  });

  it('badge notifications : absent quand 0, présent quand > 0, "99+" au-delà de 99', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'GUEST',
      status: 'DRAFT',
      currentStep: 'cni_recto',
      completedSteps: [],
      reviewStatus: null,
    });

    // 0 → pas de badge
    mockUseNotificationUnreadCount.mockReturnValue(0);
    const { rerender, container } = renderDashboard();
    expect(container.querySelector('[data-testid="dashboard-notifications-badge"]')).toBeNull();

    // 3 → badge "3"
    mockUseNotificationUnreadCount.mockReturnValue(3);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('dashboard-notifications-badge')).toHaveTextContent('3');

    // 150 → "99+"
    mockUseNotificationUnreadCount.mockReturnValue(150);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('dashboard-notifications-badge')).toHaveTextContent('99+');
  });

  it('PENDING_INFO : affiche "Complément demandé"', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'RESTRICTED',
      status: 'PENDING_INFO',
      currentStep: 'cni_recto',
      completedSteps: ['cni_recto', 'cni_verso'],
      reviewStatus: { status: 'PENDING_INFO' },
    });
    renderDashboard();

    expect(screen.getByText(/complément demandé/i)).toBeInTheDocument();
  });

  it('DISABLED : affiche "Dossier à vérifier"', () => {
    mockUseKyc.mockReturnValue({
      accessLevel: 'DISABLED',
      status: 'DRAFT',
      currentStep: 'cni_recto',
      completedSteps: [],
      reviewStatus: null,
    });
    renderDashboard();

    expect(screen.getByText(/dossier à vérifier/i)).toBeInTheDocument();
  });
});
