import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient } from '../../services/apiClient';
import { ArrowUpRight, ArrowDownLeft, Smartphone, Zap, ShoppingCart, Briefcase } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TransactionCategory, Transaction } from '../../types';

const categoryIcons: Record<TransactionCategory, typeof ArrowUpRight> = {
  transfer_out: ArrowUpRight,
  transfer_in: ArrowDownLeft,
  mobile_recharge: Smartphone,
  bill_payment: Zap,
  purchase: ShoppingCart,
  salary: Briefcase,
};

const categoryColors: Record<TransactionCategory, string> = {
  transfer_out: 'bg-amber-100 text-amber-600',
  transfer_in: 'bg-emerald-100 text-emerald-600',
  mobile_recharge: 'bg-blue-100 text-blue-600',
  bill_payment: 'bg-red-100 text-destructive',
  purchase: 'bg-purple-100 text-purple-600',
  salary: 'bg-emerald-100 text-emerald-600',
};

type Filter = 'all' | 'in' | 'out';

export function TransactionHistoryScreen() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cat = filter === 'all' ? '' : filter;
    apiClient.get<{ transactions: Transaction[] }>(`/banking/transactions${cat ? `?category=${cat}` : ''}`)
      .then(data => setTransactions(data?.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = transactions.filter((tx) => {
    if (filter === 'in') return tx.amount > 0;
    if (filter === 'out') return tx.amount < 0;
    return true;
  });

  const fmt = (n: number) => Math.abs(n).toLocaleString('fr-FR');
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background">
      <ScreenLayoutV2 showBack title={t('transactions.title')}>
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            {(['all', 'in', 'out'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-full text-xs font-medium transition-all',
                  filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {t(`transactions.filter.${f}`)}
              </button>
            ))}
          </div>

          {loading && (
            <div className="space-y-2 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl" />)}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <ArrowUpRight className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">{t('transactions.empty')}</p>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((tx) => {
              const Icon = categoryIcons[tx.category] || ArrowUpRight;
              const colorClass = categoryColors[tx.category] || 'bg-muted text-muted-foreground';
              return (
                <div key={tx.id} className="bg-card border border-border rounded-2xl p-4 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3">
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colorClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.label}</p>
                      <p className="text-xs text-muted-foreground">{tx.counterparty} • {formatDate(tx.date)}</p>
                    </div>
                    <span className={cn('text-sm font-bold whitespace-nowrap', tx.amount > 0 ? 'text-emerald-500' : 'text-foreground')}>
                      {tx.amount > 0 ? '+' : '-'}{fmt(tx.amount)} F
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScreenLayoutV2>
    </div>
  );
}
