import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useKyc } from '../../contexts/KycContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../lib/utils';
import type { AccountInfo, Transaction, SavingsPocket } from '../../types';
import {
  Bell,
  Eye,
  EyeOff,
  Lock,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  ChevronRight,
  ExternalLink,
  Building2,
  Briefcase,
  TrendingUp,
  ArrowDownLeft,
  ShieldCheck,
  Clock,
  Ban,
  CheckCircle,
} from 'lucide-react';

const TIER_CONFIG = {
  GUEST: { label: 'Accès invité', color: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', icon: Eye, canServices: false },
  RESTRICTED: { label: 'Accès restreint', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: Clock, canServices: false },
  LIMITED_ACCESS: { label: 'Accès limité', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: ShieldCheck, canServices: true },
  FULL_ACCESS: { label: 'Accès complet', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: CheckCircle, canServices: true },
  DISABLED: { label: 'Accès bloqué', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: Ban, canServices: false },
};

const ecosystem = [
  { id: 'online', icon: Building2, fr: 'BICEC Online', descFr: 'Banque en ligne' },
  { id: 'pro', icon: Briefcase, fr: 'BICEC Pro', descFr: 'Espace professionnel' },
  { id: 'card', icon: CreditCard, fr: 'BICEC Card', descFr: 'Gestion cartes' },
  { id: 'invest', icon: TrendingUp, fr: 'BICEC Invest', descFr: 'Investissements' },
];

export function DashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { accessLevel } = useKyc();
  const navigate = useNavigate();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pockets, setPockets] = useState<SavingsPocket[]>([]);
  const [loading, setLoading] = useState({ account: true, txs: true, pockets: true });

  const tier = TIER_CONFIG[accessLevel] ?? TIER_CONFIG.GUEST;
  const isRestricted = accessLevel === 'RESTRICTED' || accessLevel === 'GUEST';
  const isLimited = accessLevel === 'LIMITED_ACCESS';
  const isFull = accessLevel === 'FULL_ACCESS';
  const isKycDone = isFull || isLimited;

  useEffect(() => {
    apiClient.get<AccountInfo>('/banking/account')
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setLoading(s => ({ ...s, account: false })));
  }, []);

  useEffect(() => {
    apiClient.get<{ transactions: Transaction[] }>('/banking/transactions?page_size=3')
      .then(data => setTransactions(data?.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(s => ({ ...s, txs: false })));
  }, []);

  useEffect(() => {
    apiClient.get<{ pockets: SavingsPocket[] }>('/banking/savings/pockets')
      .then(data => setPockets(data?.pockets || []))
      .catch(() => setPockets([]))
      .finally(() => setLoading(s => ({ ...s, pockets: false })));
  }, []);

  const fmtAmount = (n: number) => Math.abs(n).toLocaleString('fr-FR');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const quickActions = [
    { icon: ArrowUpRight, label: 'Envoyer', locked: isRestricted, path: '/transfers/send' },
    { icon: CreditCard, label: 'Cartes', locked: isRestricted, path: '/cards' },
    { icon: PiggyBank, label: 'Épargne', locked: isRestricted, path: '/savings' },
  ];

  const recentTx = transactions.slice(0, 3);

  return (
    <div className="bg-background">
      {/* Hero Header */}
      <div className="gradient-primary px-6 pt-12 pb-8 rounded-b-3xl safe-top">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-foreground/70 text-sm">{t('dashboard.greeting')}</p>
            <h1 className="text-xl font-bold text-primary-foreground">{user?.phone?.replace('+237', '') || 'Marie'} 👋</h1>
          </div>
          <button onClick={() => navigate('/notifications')} className="relative h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center">2</span>
          </button>
        </div>

        {(isRestricted || isLimited) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={cn('rounded-xl px-4 py-2 text-sm font-medium mb-4', 'bg-warning/20 text-warning')}>
            {isRestricted ? t('dashboard.restricted.banner') : t('dashboard.limited.banner')}
          </motion.div>
        )}

        {/* Balance Card */}
        <div className="glass rounded-2xl p-5 !bg-white/10 !backdrop-blur-xl !border-white/10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-primary-foreground/70 text-xs">{t('dashboard.balance')}</p>
            {isKycDone && (
              <button onClick={() => setBalanceVisible(!balanceVisible)} className="p-1">
                {balanceVisible ? <Eye className="h-4 w-4 text-primary-foreground/50" /> : <EyeOff className="h-4 w-4 text-primary-foreground/50" />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold text-primary-foreground">
              {loading.account ? '---' : isRestricted ? '---' : balanceVisible ? (account?.balance ?? 0).toLocaleString('fr-FR') : '••••••'}
            </h2>
            {!isRestricted && balanceVisible && !loading.account && <span className="text-primary-foreground/70 text-sm">FCFA</span>}
            {isRestricted && <Lock className="h-4 w-4 text-primary-foreground/50" />}
          </div>
          <span className="text-xs text-primary-foreground/50">{t('dashboard.mainAccount')}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 -mt-4">
        <div className="flex gap-3">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => !action.locked && navigate(action.path)}
              className="flex-1 glass rounded-2xl p-4 flex flex-col items-center gap-2 relative"
              disabled={action.locked}
            >
              <div className="relative">
                <action.icon className={cn('h-6 w-6', action.locked ? 'text-muted-foreground' : 'text-primary')} />
                {action.locked && <Lock className="h-3 w-3 text-muted-foreground absolute -top-1 -right-1" />}
              </div>
              <span className="text-xs font-medium text-foreground">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 space-y-6">
        {/* KYC Banner (if not full access) */}
        {!isKycDone && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('glass rounded-2xl p-5 border-l-4', tier.borderColor, tier.bgColor)}>
            <div className="flex items-start gap-3">
              <tier.icon className={cn('h-6 w-6 shrink-0', tier.color)} />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{tier.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.kycRequired')}</p>
                <button onClick={() => navigate('/kyc/intro')} className="mt-3 w-full h-10 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-all">
                  {t('dashboard.completeKyc')}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{t('dashboard.recentTransactions')}</h3>
            <button onClick={() => navigate('/transactions')} className="text-xs text-primary font-medium flex items-center gap-1">
              {t('common.seeAll')} <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {loading.txs && (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-200 rounded-2xl" />)}
            </div>
          )}

          {!loading.txs && recentTx.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <ArrowDownLeft className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">{t('transactions.empty')}</p>
            </div>
          )}

          <div className="space-y-2">
            {recentTx.map((tx) => (
              <div key={tx.id} className="glass rounded-2xl p-3 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', tx.amount > 0 ? 'bg-success/10' : 'bg-muted')}>
                    {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4 text-success" /> : <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{tx.label}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(tx.date)}</p>
                  </div>
                  <span className={cn('text-xs font-bold', tx.amount > 0 ? 'text-success' : 'text-foreground')}>
                    {tx.amount > 0 ? '+' : '-'}{fmtAmount(tx.amount)} F
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Savings Pockets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{t('dashboard.pockets')}</h3>
            <button onClick={() => navigate('/savings')} className="text-xs text-primary font-medium flex items-center gap-1">
              {t('common.seeAll')} <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {loading.pockets && (
            <div className="space-y-2 animate-pulse">
              {[1,2].map(i => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}
            </div>
          )}

          {!loading.pockets && pockets.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <PiggyBank className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">{t('savings.empty')}</p>
            </div>
          )}

          <div className="space-y-3">
            {pockets.slice(0, 2).map((pocket) => {
              const progress = Math.min((pocket.amount / pocket.goal) * 100, 100);
              return (
                <div key={pocket.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{pocket.name}</span>
                    <span className="text-sm font-bold text-foreground">{isRestricted ? '---' : pocket.amount.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', pocket.color)} style={{ width: isRestricted ? '0%' : `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Objectif: {pocket.goal.toLocaleString('fr-FR')} FCFA</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* BICEC Ecosystem */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.ecosystem')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {ecosystem.map((app) => (
              <button key={app.id} className="glass rounded-2xl p-4 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <app.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-foreground truncate">{app.fr}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{app.descFr}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
