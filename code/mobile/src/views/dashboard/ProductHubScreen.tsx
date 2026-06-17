import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Landmark,
  Lock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useKyc } from '../../contexts/KycContext';
import { cn } from '../../lib/utils';

const products = [
  {
    name: 'BI PAY',
    desc: 'Je vous redirige vers les paiements et services mobiles BICEC après validation.',
    icon: Smartphone,
    accent: 'bg-blue-50 text-blue-700',
  },
  {
    name: 'BICEC Wallet',
    desc: 'Je prépare votre accès Wallet selon votre appareil et la disponibilité BICEC.',
    icon: Wallet,
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    name: 'BiCresco',
    desc: 'Je vous présente les offres et parcours BICEC utiles après votre entrée en relation.',
    icon: Building2,
    accent: 'bg-amber-50 text-amber-700',
  },
  {
    name: 'BICEC Mobile-Banking',
    desc: 'Je vous oriente vers l’application aval pour les opérations bancaires.',
    icon: Landmark,
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    name: 'Cartes BICEC',
    desc: 'Je garde la gestion carte dans les applications BICEC après KYC.',
    icon: CreditCard,
    accent: 'bg-orange-50 text-orange-700',
  },
];

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  return 'Web';
}

export function ProductHubScreen() {
  const navigate = useNavigate();
  const { accessLevel } = useKyc();
  const platform = useMemo(() => detectPlatform(), []);
  const canHandoff = accessLevel === 'LIMITED_ACCESS' || accessLevel === 'FULL_ACCESS';

  return (
    <ScreenLayoutV2 showBack title="Produits BICEC" className="liquid-screen" contentClassName="px-5 py-5">
      <div className="space-y-5 pb-28">
        <section className="liquid-hero rounded-[2rem] p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_16px_34px_rgba(232,117,0,0.22)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Passerelle VeriPass</p>
              <h1 className="mt-2 text-xl font-black leading-tight text-foreground">Applications BICEC après KYC</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Je vérifie votre dossier, puis je prépare la redirection vers l’app adaptée à votre appareil.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5 backdrop-blur-xl">
              <p className="text-[11px] font-bold text-muted-foreground">Appareil détecté</p>
              <p className="mt-1 text-sm font-black text-foreground">{platform}</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5 backdrop-blur-xl">
              <p className="text-[11px] font-bold text-muted-foreground">Statut handoff</p>
              <p className={cn('mt-1 text-sm font-black', canHandoff ? 'text-emerald-700' : 'text-amber-700')}>
                {canHandoff ? 'Prêt' : 'Après validation'}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {products.map((product, index) => (
            <button
              key={product.name}
              type="button"
              className={cn(
                'liquid-glass flex w-full items-center gap-3 rounded-3xl p-4 text-left active:scale-[0.99]',
                index === 3 && 'mt-28'
              )}
            >
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', product.accent)}>
                <product.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black text-foreground">{product.name}</p>
                  {!canHandoff && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{product.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </section>

        <button
          type="button"
          onClick={() => navigate('/cards/atm-finder')}
          className="flex w-full items-center justify-between rounded-3xl bg-[#12355b] px-5 py-4 text-left text-white shadow-[0_18px_38px_rgba(18,53,91,0.22)] active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <MapPin className="h-5 w-5" />
            <span>
              <span className="block text-xs font-black uppercase opacity-70">Service utile maintenant</span>
              <span className="block text-sm font-black">Trouver un GAB BICEC</span>
            </span>
          </span>
          <ExternalLink className="h-5 w-5" />
        </button>
      </div>
    </ScreenLayoutV2>
  );
}
