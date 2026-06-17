import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  Bell,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Landmark,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { KycResumeBanner } from '../../components/KycResumeBanner';
import { useKyc } from '../../contexts/KycContext';
import { cn } from '../../lib/utils';
import type { AccessTier, KycStatus, KycStepType } from '../../types';

const KYC_STEPS: Array<{ id: KycStepType; label: string; route: string }> = [
  { id: 'cni_recto', label: 'Capturer la CNI recto', route: '/kyc/cni-recto-guide' },
  { id: 'cni_verso', label: 'Capturer la CNI verso', route: '/kyc/cni-verso-guide' },
  { id: 'liveness', label: 'Confirmer la présence physique', route: '/kyc/liveness-intro' },
  { id: 'utility_bill', label: 'Ajouter le justificatif de domicile', route: '/kyc/bill-select' },
  { id: 'address', label: 'Confirmer l’adresse de résidence', route: '/kyc/address' },
  { id: 'niu', label: 'Renseigner le NIU si disponible', route: '/kyc/niu' },
  { id: 'consent', label: 'Valider les consentements', route: '/kyc/consent' },
  { id: 'signature', label: 'Signer le dossier', route: '/kyc/signature' },
  { id: 'ocr_review', label: 'Vérifier les informations OCR', route: '/kyc/ocr-review' },
  { id: 'submission', label: 'Relire et transmettre le dossier', route: '/kyc/review' },
];

const ACCESS_COPY: Record<AccessTier, { label: string; detail: string; icon: typeof ShieldCheck; tone: string }> = {
  GUEST: {
    label: 'Dossier à compléter',
    detail: 'Vous avez encore des informations à rassembler avant de pouvoir vous orienter vers les applications BICEC.',
    icon: Clock,
    tone: 'text-[#12355b] bg-white/72 border-slate-200',
  },
  RESTRICTED: {
    label: 'Dossier complet',
    detail: 'Vous n’avez plus rien à compléter pour le moment. Nous vous prévenons si un complément est nécessaire.',
    icon: ShieldCheck,
    tone: 'text-blue-800 bg-blue-50 border-blue-200',
  },
  LIMITED_ACCESS: {
    label: 'Orientation prête',
    detail: 'Votre dossier est validé. Les produits et services disponibles vous sont présentés selon votre parcours.',
    icon: BadgeCheck,
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  FULL_ACCESS: {
    label: 'Identité vérifiée',
    detail: 'Votre identité est vérifiée. Les produits et services disponibles vous sont présentés selon votre parcours.',
    icon: CheckCircle,
    tone: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  DISABLED: {
    label: 'Accès suspendu',
    detail: 'Je garde la redirection suspendue jusqu’à l’intervention BICEC.',
    icon: Ban,
    tone: 'text-red-700 bg-red-50 border-red-200',
  },
};

const productCards = [
  {
    name: 'BI PAY',
    desc: 'Retrouvez les paiements mobiles lorsque ce service est disponible dans votre parcours.',
    icon: Smartphone,
    tag: 'Paiement',
  },
  {
    name: 'BICEC Wallet',
    desc: 'Suivez la disponibilité Wallet selon votre appareil et votre profil.',
    icon: Wallet,
    tag: 'Wallet',
  },
  {
    name: 'BiCresco',
    desc: 'Consultez les offres utiles après votre entrée en relation.',
    icon: Building2,
    tag: 'Produit BICEC',
  },
  {
    name: 'Cartes BICEC',
    desc: 'Retrouvez les informations cartes lorsque le service est disponible.',
    icon: CreditCard,
    tag: 'Cartes',
  },
];

const dossierEvents = [
  { title: 'Votre dossier', detail: 'Vos pièces, vos consentements et vos informations sont regroupés.', state: 'Actif' },
  { title: 'Suivi interne', detail: 'Le dossier complet peut être vérifié avant toute nouvelle étape.', state: 'Protégé' },
  { title: 'Services à venir', detail: 'Les nouveautés seront présentées dans VeriPass dès leur disponibilité.', state: 'Prévu' },
];

const INFO_REQUEST_STATUSES: KycStatus[] = ['PENDING_INFO', 'INFO_REQUESTED', 'PENDING_RESUBMIT'];

export function DashboardPage() {
  const { accessLevel, currentStep, completedSteps, reviewStatus, status } = useKyc();
  const navigate = useNavigate();

  const access = ACCESS_COPY[accessLevel] ?? ACCESS_COPY.GUEST;
  const AccessIcon = access.icon;
  const completedCount = new Set(completedSteps).size;
  const progress = Math.min(Math.round((completedCount / KYC_STEPS.length) * 100), 100);
  const nextStep = KYC_STEPS.find((step) => step.id === currentStep) ?? KYC_STEPS[0];
  const canHandoff = accessLevel === 'LIMITED_ACCESS' || accessLevel === 'FULL_ACCESS';
  const reviewLabel = reviewStatus?.status ?? status;
  const needsComplement = INFO_REQUEST_STATUSES.includes(reviewLabel);
  const isUnderReview = accessLevel === 'RESTRICTED' && !needsComplement;
  const isCompleteState = canHandoff || isUnderReview;
  const heroCopy = isCompleteState
    ? {
        title: 'Merci pour votre confiance',
        description:
          'Votre compte VeriPass est créé. Merci de renouveler votre confiance à la BICEC. Nous vous tiendrons informé des nouveautés et des services disponibles dans votre parcours.',
        actionEyebrow: 'Produits',
        actionLabel: 'Découvrir les produits BICEC',
        actionRoute: '/products',
      }
    : needsComplement
        ? {
            title: 'Complément demandé',
            description: 'Une pièce ou une information doit être complétée. Nous vous ramenons au bon endroit pour finaliser votre dossier.',
            actionEyebrow: 'Action requise',
            actionLabel: nextStep.label,
            actionRoute: nextStep.route,
          }
        : accessLevel === 'DISABLED'
          ? {
              title: 'Dossier à vérifier',
              description: 'Le passage vers les services reste fermé pendant la vérification du dossier.',
              actionEyebrow: 'Assistance',
              actionLabel: 'Contacter le support dossier',
              actionRoute: '/support',
            }
          : {
              title: 'Votre dossier client',
              description: 'Par ce dossier nous vérifions votre identité et préparons votre passage vers les applications BICEC.',
              actionEyebrow: 'Prochaine étape',
              actionLabel: nextStep.label,
              actionRoute: nextStep.route,
            };

  return (
    <div className="liquid-screen min-h-full overflow-hidden">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <header className="liquid-glass rounded-[1.75rem] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">BICEC VeriPass</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-foreground">Bonjour</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/70 shadow-sm backdrop-blur-2xl active:scale-95"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-foreground" />
              <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-white">
                2
              </span>
            </button>
          </div>
        </header>

        <main className="mt-5 space-y-5 pb-32">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-hero rounded-[2rem] p-4"
          >
            <div className="space-y-3">
              <h2 className="text-2xl font-black leading-tight text-foreground">{heroCopy.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{heroCopy.description}</p>
            </div>

            {!isCompleteState && <div className={cn('mt-4 rounded-2xl border p-4', access.tone)}>
              <div className="flex items-start gap-3">
                <AccessIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">{access.label}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{access.detail}</p>
                </div>
              </div>
            </div>}

            {isCompleteState ? (
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="mt-5 flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white/72 px-4 py-3 text-left text-[#12355b] shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-2xl active:scale-[0.99]"
              >
                <span className="text-sm font-black">Découvrir les produits BICEC</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
            <div className="mt-4 rounded-2xl bg-white/68 p-4 ring-1 ring-black/5 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">Progression dossier</p>
                <p className="text-xs font-black text-foreground">{progress}%</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-[#12355b] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(heroCopy.actionRoute)}
                className={cn(
                  'mt-4 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-white active:scale-[0.99]',
                  'bg-[#12355b] shadow-[0_14px_30px_rgba(18,53,91,0.20)]',
                )}
              >
                <span>
                  <span className="block text-[11px] font-black uppercase opacity-80">{heroCopy.actionEyebrow}</span>
                  <span className="block text-sm font-black">{heroCopy.actionLabel}</span>
                </span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            )}
          </motion.section>

          {!isCompleteState && <KycResumeBanner />}

          <section className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/cards/atm-finder')}
              className="liquid-glass rounded-3xl p-4 text-left active:scale-[0.98]"
            >
              <MapPin className="h-6 w-6 text-primary" />
              <p className="mt-4 text-sm font-black text-foreground">GAB BICEC</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Trouvez un guichet proche de vous sans ouvrir de service bancaire.</p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="liquid-glass rounded-3xl p-4 text-left active:scale-[0.98]"
            >
              <MessageCircle className="h-6 w-6 text-primary" />
              <p className="mt-4 text-sm font-black text-foreground">Support dossier</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Contactez-nous pour une pièce, une correction ou le suivi du dossier.</p>
            </button>
          </section>

          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Produits BICEC</p>
                <h3 className="text-lg font-black text-foreground">Passerelle après validation</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="rounded-full bg-white/70 px-3 py-2 text-xs font-black text-primary ring-1 ring-black/5 backdrop-blur-xl"
              >
                Voir tout
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {productCards.slice(0, 3).map((product, index) => (
                <motion.button
                  key={product.name}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * index }}
                  onClick={() => navigate('/products')}
                  className="liquid-glass flex items-center gap-3 rounded-3xl p-4 text-left active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <product.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-foreground">{product.name}</p>
                      {!canHandoff && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.desc}</p>
                  </div>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-muted-foreground ring-1 ring-black/5">
                    {product.tag}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>

          <section className="liquid-glass rounded-[1.75rem] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#12355b]/10">
                <Landmark className="h-5 w-5 text-[#12355b]" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Services bancaires masqués</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  VeriPass reste consacré à l’entrée en relation. Les opérations bancaires restent dans les services dédiés.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-foreground">Suivi du dossier</h3>
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black text-muted-foreground ring-1 ring-black/5">
                {reviewLabel}
              </span>
            </div>
            <div className="space-y-2">
              {dossierEvents.map((event) => (
                <div key={event.title} className="liquid-glass flex items-center gap-3 rounded-3xl p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-black/5">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">{event.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.detail}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                    {event.state}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => navigate('/products')}
            className="flex w-full items-center justify-between rounded-3xl bg-[#12355b] px-5 py-4 text-left text-white shadow-[0_18px_38px_rgba(18,53,91,0.22)] active:scale-[0.99]"
          >
            <span>
              <span className="block text-xs font-black uppercase opacity-70">Handoff mobile</span>
              <span className="block text-base font-black">Voir les applications BICEC</span>
            </span>
            <ExternalLink className="h-5 w-5" />
          </button>
        </main>
      </div>
    </div>
  );
}
