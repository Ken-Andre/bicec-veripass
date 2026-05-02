import { useState, useEffect, useCallback } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useKyc } from '../../contexts/KycContext';
import type { AccessTier, KycStatus } from '../../types';
import { assertNever } from '../../types';
import type { ReviewStatus } from '../../contexts/KycContext';
import { User, ShieldCheck, CreditCard, Landmark, History, PlusCircle, ArrowRight, LogOut, Settings, Trash2, X, Clock, AlertTriangle, CheckCircle, XCircle, Eye, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';

// ---------------------------------------------------------------------------
// ADR-001: Access tier UI configuration
// ---------------------------------------------------------------------------
const TIER_CONFIG: Record<AccessTier, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof ShieldCheck; canServices: boolean; canTransfers: boolean }> = {
  GUEST: {
    label: 'Accès invité',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: Eye,
    canServices: false,
    canTransfers: false,
  },
  RESTRICTED: {
    label: 'Accès restreint',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Clock,
    canServices: false,
    canTransfers: false,
  },
  LIMITED_ACCESS: {
    label: 'Accès limité',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: ShieldCheck,
    canServices: true,
    canTransfers: false,
  },
  FULL_ACCESS: {
    label: 'Accès complet',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: CheckCircle,
    canServices: true,
    canTransfers: true,
  },
  DISABLED: {
    label: 'Accès bloqué',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: Ban,
    canServices: false,
    canTransfers: false,
  },
};

// Status labels for KYC review states — typed on KycStatus to catch missing entries at compile time.
const STATUS_LABELS: Record<KycStatus, { label: string; description: string }> = {
  // Backend statuses returned by /kyc/review-status
  DRAFT: { label: 'Dossier en preparation', description: 'Completez les etapes pour soumettre votre KYC.' },
  PENDING_AGENT_REVIEW: { label: 'En cours de validation', description: 'Votre dossier est en attente de traitement par un agent BICEC.' },
  PENDING_KYC: { label: 'Verification agent en cours', description: 'Votre dossier est en attente de traitement par Jean.' },
  PENDING_INFO: { label: 'Informations complementaires requises', description: 'Ajoutez les pieces demandees pour continuer.' },
  APPROVED: { label: 'Dossier approuve', description: 'Votre dossier a ete approuve. Votre compte est en cours de creation.' },
  REJECTED: { label: 'Dossier rejete', description: 'Votre dossier a ete rejete. Vous pouvez recommencer la procedure.' },
  FRAUD_SUSPECT: { label: 'Dossier en verification approfondie', description: 'Votre dossier fait l\'objet d\'un controle special.' },
  NO_SUBMISSION: { label: 'Aucun dossier soumis', description: 'Commencez votre parcours KYC pour ouvrir votre compte.' },
  // Frontend-only statuses (conservés pour compatibilité)
  COMPLIANCE_REVIEW: { label: 'Revue conformite AML/CFT', description: 'Votre dossier est en controle compliance.' },
  READY_FOR_OPS: { label: 'Pret pour ouverture de compte', description: 'Le dossier est valide et transmis aux operations.' },
  PROVISIONING: { label: 'Provisioning bancaire en cours', description: 'Creation du compte en cours dans le SI bancaire.' },
  OPS_ERROR: { label: 'Erreur operationnelle', description: 'Une erreur technique est survenue. Nouvelle tentative en cours.' },
  OPS_CORRECTION: { label: 'Correction operationnelle requise', description: 'Des corrections sont necessaires avant activation.' },
  VALIDATED_PENDING_AGENCY: { label: 'Valide en attente agence', description: 'Le dossier est valide, finalisation agence en attente.' },
  ACTIVATED_LIMITED: { label: 'Compte active (acces limite)', description: 'Compte actif avec restrictions en attendant NIU valide.' },
  ACTIVATED_PRE_FULL: { label: 'Compte pre-active', description: 'Derniere validation agence requise pour acces complet.' },
  ACTIVATED_FULL: { label: 'Compte active complet', description: 'Votre compte est pleinement actif.' },
  EXPIRY_WARNING: { label: 'Document bientot expire', description: 'Renouvelez vos documents pour maintenir vos acces.' },
  PENDING_RESUBMIT: { label: 'Resoumission requise', description: 'Soumettez les nouveaux documents demandes.' },
  MONITORED: { label: 'Compte sous surveillance', description: 'Votre compte reste actif avec surveillance renforcee.' },
  DISABLED: { label: 'Compte bloque', description: 'Acces suspendu. Contactez le support BICEC.' },
  ABANDONED: { label: 'Session abandonnee', description: 'Votre session a expire. Reprenez le parcours KYC.' },
  SUBMITTED: { label: 'Dossier soumis', description: 'Votre dossier a ete soumis avec succes.' },
  INFO_REQUESTED: { label: 'Informations requises', description: 'Des informations supplementaires sont demandees.' },
  PENDING: { label: 'En attente', description: 'Traitement en cours.' },
  IN_PROGRESS: { label: 'En cours', description: 'Traitement en cours.' },
  COMPLETED: { label: 'Termine', description: 'Le traitement est termine.' },
  FAILED: { label: 'Echec', description: 'Une erreur est survenue.' },
  MANUAL_REVIEW: { label: 'Revue manuelle', description: 'Votre dossier necessite une revue manuelle.' },
};

const REVIEW_POLL_INTERVAL_MS = 30_000; // 30s

export function DashboardPage() {
  const { user, logout, isAuthenticated, isLocked } = useAuth();
  const navigate = useNavigate();
  const { accessLevel, setAccessLevel, setStatus, setReviewStatus, reviewStatus } = useKyc();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // -----------------------------------------------------------------------
  // ADR-001: Poll /kyc/review-status to sync access tier from backend
  // -----------------------------------------------------------------------
  // Mark all unread notifications as read via bulk endpoint (single request)
  const markAllNotificationsRead = useCallback(async () => {
    if (!reviewStatus?.unreadNotifications?.length) return;
    try {
      await apiClient.post('/kyc/notifications/read?mark_all=true', {});
    } catch {
      // Best effort — will be retried on next poll if still unread
    }
    // Optimistically clear from local state
    setReviewStatus({
      ...reviewStatus,
      unreadNotifications: [],
    });
  }, [reviewStatus, setReviewStatus]);

  const fetchReviewStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<any>('/kyc/review-status');
      const data: ReviewStatus = {
        status: (res.status as KycStatus) ?? 'DRAFT',
        accessLevel: (res.access_level as AccessTier) ?? 'GUEST',
        submittedAt: res.submitted_at ?? null,
        completedAt: res.completed_at ?? null,
        decision: res.decision ?? null,
        unreadNotifications: res.unread_notifications ?? [],
      };
      setReviewStatus(data);
      // Sync access level and status from backend
      setAccessLevel(data.accessLevel);
      setStatus(data.status);
    } catch {
      // Not authenticated or no session — keep current state
    }
  }, [setAccessLevel, setStatus, setReviewStatus]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Initial fetch
    void fetchReviewStatus();
    // Polling
    const interval = setInterval(() => void fetchReviewStatus(), REVIEW_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchReviewStatus]);

  // Redirects
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isLocked) {
      navigate('/auth/lock', { replace: true });
    }
  }, [isLocked, navigate]);

  if (!isAuthenticated) return null;

  const tier = TIER_CONFIG[accessLevel] ?? TIER_CONFIG.GUEST;
  const TierIcon = tier.icon;
  const statusInfo = reviewStatus ? STATUS_LABELS[reviewStatus.status] : null;
  const latestNotification = reviewStatus?.unreadNotifications?.[0];
  const decision = reviewStatus?.decision;
  const isKycDone = accessLevel === 'FULL_ACCESS' || accessLevel === 'LIMITED_ACCESS';
  const isRejected = reviewStatus?.status === 'REJECTED';
  const isFraudSuspect = accessLevel === 'DISABLED';
  const pendingStatuses = new Set([
    'PENDING_AGENT_REVIEW',
    'PENDING_KYC',
    'PENDING_INFO',
    'COMPLIANCE_REVIEW',
    'READY_FOR_OPS',
    'PROVISIONING',
    'OPS_ERROR',
    'OPS_CORRECTION',
    'VALIDATED_PENDING_AGENCY',
  ]);
  const isPendingReview = reviewStatus?.status ? pendingStatuses.has(reviewStatus.status) : accessLevel === 'RESTRICTED';

  return (
    <ScreenLayout showNav title="Tableau de bord">
      <div className="space-y-8 pb-10">
        {/* Premium Profile Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-bicec-blue to-blue-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-bicec-red/10 rounded-full -ml-16 -mb-16 blur-2xl opacity-30" />

          <div className="relative flex justify-between items-center mb-10">
            <div className="space-y-1">
              <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Compte VeriPass</p>
              <h2 className="text-3xl font-black">{user?.phone?.replace('+237', '') || 'Utilisateur'}</h2>
            </div>
            <div className="h-16 w-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[1.5rem] flex items-center justify-center shadow-inner">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* ADR-001: Access Tier Badge */}
          <div className="relative flex items-center justify-between">
            <div className="flex -space-x-3">
              <div className="h-10 w-10 rounded-full border-2 border-primary bg-primary-bicec-red flex items-center justify-center text-[10px] font-bold shadow-lg">B</div>
              <div className="h-10 w-10 rounded-full border-2 border-primary bg-white/20 backdrop-blur-md flex items-center justify-center text-[10px] font-bold shadow-lg">VP</div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold uppercase tracking-tighter ${tier.bgColor} ${tier.color} ${tier.borderColor} border`}>
              <TierIcon className="w-3.5 h-3.5" />
              {tier.label}
            </div>
          </div>
        </div>

        {/* ADR-001: Review Status Banner (shown when not yet FULL_ACCESS) */}
        {!isKycDone && (
          <div className={`relative overflow-hidden rounded-[2rem] p-6 border-2 shadow-lg transition-all ${tier.bgColor} ${tier.borderColor}`}>
            <div className="flex items-start gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${tier.bgColor}`}>
                {isFraudSuspect ? (
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                ) : isRejected ? (
                  <XCircle className="w-8 h-8 text-red-500" />
                ) : isPendingReview ? (
                  <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-8 h-8 text-primary-bicec-red" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-lg font-black text-slate-800">
                  {statusInfo?.label ?? 'Chargement du statut...'}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {statusInfo?.description ?? 'Synchronisation avec le serveur en cours.'}
                </p>

                {/* Decision info */}
                {decision && (
                  <div className="mt-2 text-xs bg-white/60 rounded-lg px-3 py-2 border border-slate-200">
                    <span className="font-semibold">Décision : </span>
                    {decision.decision === 'APPROVED' ? 'Approuvé' : decision.decision === 'REJECTED' ? `Refusé — ${decision.reason ?? ''}` : decision.decision === 'INFO_REQUESTED' ? `Infos requises — ${decision.reason ?? ''}` : decision.decision}
                  </div>
                )}

                {/* Latest notification — with mark-as-read on tap */}
                {latestNotification && (
                  <button
                    onClick={() => markAllNotificationsRead()}
                    className="mt-2 w-full text-left text-xs bg-blue-50 rounded-lg px-3 py-2 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-semibold text-blue-800">🔔 </span>
                    <span className="text-blue-700">{latestNotification.message}</span>
                    <span className="text-blue-400 float-right">Marquer lu</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6">
              {isRejected ? (
                <button
                  onClick={() => navigate('/kyc/intro')}
                  className="bicec-button w-full h-14 text-md flex items-center justify-center gap-3"
                >
                  Recommencer la procédure KYC
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : isFraudSuspect ? (
                <div className="text-center text-sm text-red-600 font-medium">
                  Notre équipe vous contactera. Pour toute question, appelez le +237 612 345 678.
                </div>
              ) : isPendingReview ? (
                <div className="flex items-center gap-2 justify-center text-sm text-amber-600 font-medium">
                  <Clock className="w-4 h-4 animate-spin" />
                  Délai estimé : 24-48h ouvrées
                </div>
              ) : (
                <button
                  onClick={() => navigate('/kyc/intro')}
                  className="bicec-button w-full h-16 text-md flex items-center justify-center gap-3"
                >
                  Démarrer la certification KYC
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* APPROVED but NIU missing → LIMITED_ACCESS banner */}
        {accessLevel === 'LIMITED_ACCESS' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-[2rem] p-5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Accès limité</p>
              <p className="text-xs text-blue-600 mt-1">
                Votre NIU n'est pas encore validé. Les virements sortants et certains services ne sont pas disponibles.
                Ajoutez votre NIU pour obtenir l'accès complet.
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions Title */}
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-extrabold text-slate-800">Services BICEC</h3>
          <button className="text-primary font-bold text-sm">Voir tout</button>
        </div>

        {/* Modern Action Grid */}
        <div className="grid grid-cols-2 gap-5">
          <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 transition-all ${!tier.canServices ? 'opacity-40 pointer-events-none' : 'active:scale-95 active:bg-slate-50'}`}>
            <div className="p-4 bg-blue-50 rounded-2xl">
              <Landmark className="w-6 h-6 text-primary-bicec-blue" />
            </div>
            <div>
              <p className="font-black text-slate-800">Comptes</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Consultation</p>
            </div>
          </div>

          <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 transition-all ${!tier.canServices ? 'opacity-40 pointer-events-none' : 'active:scale-95 active:bg-slate-50'}`}>
            <div className="p-4 bg-red-50 rounded-2xl">
              <CreditCard className="w-6 h-6 text-primary-bicec-red" />
            </div>
            <div>
              <p className="font-black text-slate-800">Cartes</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestion GIMAC</p>
            </div>
          </div>

          <div className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-start space-y-4 transition-all ${!tier.canServices ? 'opacity-40 pointer-events-none' : 'active:scale-95 active:bg-slate-50'}`}>
            <div className="p-4 bg-amber-50 rounded-2xl">
              <History className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-black text-slate-800">Historique</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Transactions</p>
            </div>
          </div>

          <div className="bg-primary-bicec-blue p-6 rounded-[2rem] shadow-lg shadow-primary/20 flex flex-col items-start space-y-4 active:scale-95 transition-all">
            <div className="p-4 bg-white/10 rounded-2xl">
              <PlusCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-black text-white">Nouveau</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Demande</p>
            </div>
          </div>
        </div>

        {/* FULL_ACCESS Celebration Banner */}
        {accessLevel === 'FULL_ACCESS' && (
          <div className="relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-[2.5rem] p-6 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/30 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-green-800">Compte pleinement activé</h4>
                <p className="text-sm text-green-600 leading-relaxed">
                  Tous les services BICEC sont disponibles. Virements, épargne, cartes — profitez de l'expérience complète.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Section */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              Paramètres
            </h3>
          </div>
          <button
            onClick={() => navigate('/settings/delete-account')}
            className="w-full flex items-center gap-4 px-6 py-5 hover:bg-red-50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-primary-bicec-red" />
            </div>
            <div>
              <p className="font-bold text-slate-800">Supprimer mon compte</p>
              <p className="text-xs text-slate-400 font-medium">Action irréversible</p>
            </div>
          </button>
        </div>

        {/* Logout Footer */}
        <div className="pt-4 pb-10">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full h-14 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
          >
            Se déconnecter
          </button>
          <p className="text-center text-[10px] text-slate-300 font-medium mt-4">
            VeriPass v1.2.0 • BICEC Official Application
          </p>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)} />
          <div className="relative bg-white rounded-t-[2rem] sm:rounded-[2.5rem] w-full sm:max-w-sm p-8 pb-12 shadow-2xl animate-slide-up">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <div className="text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Se déconnecter ?</h3>
              <p className="text-slate-500 text-sm mb-8">
                Vous devrez vous reconnecter avec votre numéro et votre PIN.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    logout();
                    navigate('/', { replace: true });
                  }}
                  className="w-full h-14 bg-primary-bicec-red text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Confirmer
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="w-full h-14 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ScreenLayout>
  );
}

