import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../services/apiClient';
import type { SavingsPocket } from '../../types';
import { Plus, PiggyBank, Target, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SavingsScreen() {
  const { t } = useLanguage();
  const [pockets, setPockets] = useState<SavingsPocket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newInitial, setNewInitial] = useState('');

  useEffect(() => {
    apiClient.get<{ pockets: SavingsPocket[] }>('/banking/savings/pockets')
      .then(data => setPockets(data?.pockets || []))
      .catch(() => setPockets([]))
      .finally(() => setLoading(false));
  }, []);

  const totalSaved = pockets.reduce((s, p) => s + p.amount, 0);
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  const handleCreatePocket = async () => {
    if (!newName || !newGoal) return;
    try {
      const created = await apiClient.post<SavingsPocket, { name: string; goal: number; initial_amount: number; color?: string; icon?: string }>('/banking/savings/pockets', {
        name: newName,
        goal: parseInt(newGoal),
        initial_amount: parseInt(newInitial) || 0,
        color: ['bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500'][pockets.length % 4],
        icon: '💰',
      });
      setPockets([...pockets, created]);
    } catch {
      // Silently fail — user can retry
    }
    setNewName(''); setNewGoal(''); setNewInitial('');
    setShowDialog(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <ScreenLayoutV2 showBack title={t('savings.title')}>
        <div className="space-y-6 pt-2">
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <PiggyBank className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t('savings.total')}</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalSaved)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('savings.pockets')}</h3>
              <button onClick={() => setShowDialog(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
                <Plus className="h-4 w-4" /> {t('savings.create')}
              </button>
            </div>

            {loading && (
              <div className="space-y-2 animate-pulse">
                {[1,2].map(i => <div key={i} className="h-20 bg-muted rounded-2xl" />)}
              </div>
            )}

            {!loading && pockets.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <PiggyBank className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">{t('savings.empty')}</p>
              </div>
            )}

            {pockets.map((pocket) => {
              const progress = Math.min((pocket.amount / pocket.goal) * 100, 100);
              return (
                <div key={pocket.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{pocket.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{pocket.name}</span>
                        <span className="text-sm font-bold text-foreground">{fmt(pocket.amount)} FCFA</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
                        <div className={cn('h-full rounded-full transition-all', pocket.color)} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{fmt(pocket.goal)} FCFA</span>
                        </div>
                        <span className="text-xs font-medium text-primary">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-success shrink-0" />
              <p className="text-xs text-muted-foreground">{t('savings.tip')}</p>
            </div>
          </div>
        </div>
      </ScreenLayoutV2>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDialog(false)} />
          <div className="relative bg-card rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-sm p-8 pb-12 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('savings.newPocket')}</h3>
            <div className="space-y-4">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('savings.pocketName')} className="w-full h-12 rounded-xl border border-border px-4 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="relative">
                <input value={newGoal} onChange={(e) => setNewGoal(e.target.value.replace(/\D/g, ''))} placeholder={t('savings.goal')} className="w-full h-12 rounded-xl border border-border px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-primary/30" inputMode="numeric" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">FCFA</span>
              </div>
              <div className="relative">
                <input value={newInitial} onChange={(e) => setNewInitial(e.target.value.replace(/\D/g, ''))} placeholder={t('savings.initialAmount')} className="w-full h-12 rounded-xl border border-border px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-primary/30" inputMode="numeric" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">FCFA</span>
              </div>
              <Button onClick={handleCreatePocket} disabled={!newName || !newGoal} className="w-full h-12">
                {t('savings.createBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
