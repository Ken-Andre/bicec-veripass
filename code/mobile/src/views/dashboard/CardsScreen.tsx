import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { apiClient } from '../../services/apiClient';
import type { BankCard } from '../../types';
import { CreditCard, Wifi, Lock, Eye, EyeOff, Copy, CheckCircle, Snowflake, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';

export function CardsScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiClient.get<BankCard[]>('/banking/cards')
      .then(data => setCards(data || []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleFreeze = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const newFrozen = !card.frozen;
    // Optimistic update
    setCards(cards.map(c => c.id === id ? { ...c, frozen: newFrozen, status: newFrozen ? 'frozen' : 'active' } : c));
    try {
      await apiClient.post(`/banking/cards/${id}/freeze`, { frozen: newFrozen });
    } catch {
      // Revert on failure
      setCards(cards.map(c => c.id === id ? { ...c, frozen: !newFrozen, status: !newFrozen ? 'frozen' : 'active' } : c));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <ScreenLayoutV2 showBack title={t('nav.cards')}>
        <div className="space-y-4 pt-2">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-48 bg-muted rounded-2xl" />
              <div className="h-16 bg-muted rounded-2xl" />
            </div>
          )}

          {!loading && cards.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">{t('cards.empty')}</p>
            </div>
          )}

          {cards.map((card) => (
            <div key={card.id} className="space-y-3">
              <div className={cn(
                'gradient-primary rounded-2xl p-6 text-white relative overflow-hidden transition-all',
                card.frozen && 'opacity-60 grayscale'
              )}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-10 -mt-10" />
                {card.frozen && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 bg-white/90 rounded-full px-4 py-2">
                      <Snowflake className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium text-foreground">{t('cards.frozen')}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-8">
                  <span className="text-sm font-medium opacity-80">{card.type === 'virtual' ? 'Virtuelle' : 'Physique'}</span>
                  <Wifi className="h-5 w-5 opacity-60" />
                </div>
                <p className="text-xl font-mono tracking-[0.2em] mb-1">
                  {showDetails[card.id] ? card.fullNumber : `•••• ${card.last4}`}
                </p>
                {showDetails[card.id] && (
                  <div className="flex gap-6 text-xs opacity-70 mb-3">
                    <span>EXP {card.expiry}</span>
                    <span>CVV {card.cvv}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm">{card.name}</span>
                  <CreditCard className="h-5 w-5 opacity-60" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetails(p => ({ ...p, [card.id]: !p[card.id] }))}
                  className="flex-1 bg-card border border-border rounded-xl py-3 flex items-center justify-center gap-2 text-xs font-medium text-foreground active:scale-95 transition-all"
                >
                  {showDetails[card.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showDetails[card.id] ? t('cards.hide') : t('cards.show')}
                </button>
                <button
                  onClick={() => handleCopy(card.fullNumber)}
                  className="flex-1 bg-card border border-border rounded-xl py-3 flex items-center justify-center gap-2 text-xs font-medium text-foreground active:scale-95 transition-all"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {t('cards.copy')}
                </button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('cards.freeze')} {card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.frozen ? t('cards.frozenDesc') : t('cards.freezeDesc')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFreeze(card.id)}
                    className={cn(
                      'relative w-12 h-7 rounded-full transition-colors',
                      card.frozen ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                      card.frozen ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => navigate('/cards/atm-finder')}
            className="w-full bg-card border border-border rounded-2xl p-4 text-left active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t('cards.findAtm')}</p>
                <p className="text-xs text-muted-foreground">{t('cards.findAtmDesc')}</p>
              </div>
            </div>
          </button>
        </div>
      </ScreenLayoutV2>
    </div>
  );
}
