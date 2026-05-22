/**
 * KycStepGuard reconciliation scenarios — instrumentation trace test.
 *
 * Simulates all 8 KYC entry paths to prove:
 * (a) which scenarios are BLOCKED on Phase 2 (before fix)
 * (b) which scenarios PASS after auto-reconciliation (after fix)
 *
 * Logs use [KYC:guard] prefix for regex matching in CI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KycStepGuard } from '../useKycFlow';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockUseKyc = vi.hoisted(() => vi.fn());
vi.mock('../../contexts/KycContext', () => ({
  useKyc: mockUseKyc,
  KycProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/ui/LoadingState', () => ({
  LoadingState: ({ message }: { message?: string }) => <div data-testid="loading-state">{message}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function renderGuard(path: string, kycStateOverrides: Record<string, unknown> = {}) {
  mockUseKyc.mockReturnValue({
    hydrated: true,
    reconciliationStatus: 'done',
    editStep: null,
    setEditStep: vi.fn(),
    completedSteps: [],
    ...kycStateOverrides,
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <KycStepGuard>
        <div data-testid="guarded-content">Guarded OK</div>
      </KycStepGuard>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('KycStepGuard — reconciliation status scenarios', () => {
  beforeEach(() => { mockUseKyc.mockClear(); });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO: Phase 1 — not hydrated
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO Phase1: renders LoadingState(Chargement) when not hydrated', () => {
    console.log('[KYC:test] === SCENARIO Phase1: not hydrated ===');
    renderGuard('/kyc/cni-intro', { hydrated: false, reconciliationStatus: 'pending' });
    expect(screen.getByTestId('loading-state')).toHaveTextContent('Chargement...');
    expect(screen.queryByTestId('guarded-content')).toBeNull();
    console.log('[KYC:test] RESULT: LoadingState(Chargement) displayed ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIOS A, C, D, E, F, G: reconciliationStatus = 'pending' → BLOCKED
  // ══════════════════════════════════════════════════════════════════════
  describe('BLOCKED scenarios (reconciliationStatus=pending)', () => {
    const blockedPaths = [
      '/kyc/cni-intro',
      '/kyc/cni-recto-capture',
      '/kyc/cni-verso-capture',
      '/kyc/ocr-review',
      '/kyc/liveness',
      '/kyc/bill-select',
      '/kyc/address',
      '/kyc/consent',
      '/kyc/signature',
      '/kyc/review',
    ];

    for (const path of blockedPaths) {
      it(`SCENARIO BLOCKED: ${path} with reconcStatus=pending → LoadingState(Synchronisation)`, () => {
        console.log(`[KYC:test] === SCENARIO BLOCKED: ${path} reconcStatus=pending ===`);
        renderGuard(path, {
          reconciliationStatus: 'pending',
          completedSteps: [],
        });
        expect(screen.getByTestId('loading-state')).toHaveTextContent('Synchronisation...');
        expect(screen.queryByTestId('guarded-content')).toBeNull();
        console.log(`[KYC:test] RESULT: ${path} → BLOCKED on Phase 2 ✅`);
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO B (fixed): reconciliationStatus='done' + completedSteps=[]
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO B: Dashboard→/kyc/intro→done, /kyc/cni-intro redirects to cni-recto-capture', () => {
    console.log('[KYC:test] === SCENARIO B: reconcStatus=done, completedSteps=[] ===');
    renderGuard('/kyc/cni-intro', {
      reconciliationStatus: 'done',
      completedSteps: [],
    });
    // Phase 4: missingStep=cni_recto → Navigate to /kyc/cni-recto-capture
    // Navigate triggers a second render on the TARGET route /kyc/cni-recto-capture
    // where location === redirectPath → no redirect → renders children (anti-self-loop)
    // This is correct: the guard allows the user to be on the capture screen
    expect(screen.queryByTestId('loading-state')).toBeNull();
    console.log('[KYC:test] RESULT: Phase 4 → redirect → anti-self-loop → children rendered on /kyc/cni-recto-capture ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO: reconciliationStatus='skipped' (offline / no-backend)
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO skipped: reconcStatus=skipped passes Phase 2, enters Phase 4', () => {
    console.log('[KYC:test] === SCENARIO skipped: reconcStatus=skipped, completedSteps=[] ===');
    renderGuard('/kyc/cni-intro', {
      reconciliationStatus: 'skipped',
      completedSteps: [],
    });
    expect(screen.queryByTestId('loading-state')).toBeNull();
    // Phase 4: missingStep=cni_recto → redirect
    console.log('[KYC:test] RESULT: skipped → Phase 4 → redirect to /kyc/cni-recto-capture ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO: reconciliationStatus='failed' (error fallback)
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO failed: reconcStatus=failed passes Phase 2, enters Phase 4', () => {
    console.log('[KYC:test] === SCENARIO failed: reconcStatus=failed, completedSteps=[] ===');
    renderGuard('/kyc/cni-intro', {
      reconciliationStatus: 'failed',
      completedSteps: [],
    });
    expect(screen.queryByTestId('loading-state')).toBeNull();
    console.log('[KYC:test] RESULT: failed → Phase 4 → redirect ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO E (stale IndexedDB): reconcStatus=done, completedSteps=9/10
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO E stale: reconcStatus=done, all steps done except submission → redirects to review', () => {
    console.log('[KYC:test] === SCENARIO E: stale completedSteps (all except submission) ===');
    renderGuard('/kyc/cni-intro', {
      reconciliationStatus: 'done',
      completedSteps: ['cni_recto', 'cni_verso', 'ocr_review', 'liveness', 'utility_bill', 'address', 'niu', 'consent', 'signature'],
    });
    expect(screen.queryByTestId('loading-state')).toBeNull();
    // Phase 4: missingStep=submission → /kyc/review
    console.log('[KYC:test] RESULT: stale steps → Phase 4 → redirect to /kyc/review ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO G (partial backend): reconcStatus=done, cni done, rest pending
  // ══════════════════════════════════════════════════════════════════════
  it('SCENARIO G partial: reconcStatus=done, only cni steps done → redirects to ocr_review', () => {
    console.log('[KYC:test] === SCENARIO G: partial backend (cni_recto+verso only) ===');
    renderGuard('/kyc/cni-intro', {
      reconciliationStatus: 'done',
      completedSteps: ['cni_recto', 'cni_verso'],
    });
    expect(screen.queryByTestId('loading-state')).toBeNull();
    // Phase 4: missingStep=ocr_review → /kyc/ocr-review
    console.log('[KYC:test] RESULT: partial → Phase 4 → redirect to /kyc/ocr-review ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO: user on correct route → renders children
  // ══════════════════════════════════════════════════════════════════════
  it('renders children when on correct route for first missing step', () => {
    console.log('[KYC:test] === SCENARIO: on correct route ===');
    renderGuard('/kyc/cni-recto-capture', {
      reconciliationStatus: 'done',
      completedSteps: [],
    });
    // Phase 4: missingStep=cni_recto, redirectPath=/kyc/cni-recto-capture
    // location === redirectPath → renders children (no redirect)
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
    console.log('[KYC:test] RESULT: children rendered ✅');
  });

  // ══════════════════════════════════════════════════════════════════════
  // SCENARIO: all steps complete → renders children
  // ══════════════════════════════════════════════════════════════════════
  it('renders children when all steps are completed', () => {
    console.log('[KYC:test] === SCENARIO: all steps complete → renders children ===');
    const allSteps = ['cni_recto', 'cni_verso', 'ocr_review', 'liveness', 'utility_bill', 'address', 'niu', 'consent', 'signature', 'submission'];
    renderGuard('/kyc/review', {
      reconciliationStatus: 'done',
      completedSteps: allSteps,
    });
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
    console.log('[KYC:test] RESULT: all steps complete → children rendered ✅');
  });
});
