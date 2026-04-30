import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { apiClient } from '../../services/apiClient';
import { buildPacs008, downloadIsoXml, isValidIban, isValidBic } from '../../services/iso20022';
import type { BuiltCreditTransfer } from '../../types';
import { Building2, Smartphone, CheckCircle, ArrowRight, Download } from 'lucide-react';
import { cn } from '../../lib/utils';

type TransferType = 'bicec' | 'mobile';
type Step = 'type' | 'details' | 'confirm' | 'success';

export function TransferSendScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('type');
  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [recipient, setRecipient] = useState('');
  const [creditorName, setCreditorName] = useState('');
  const [creditorBic, setCreditorBic] = useState('');
  const [amount, setAmount] = useState('');
  const [motif, setMotif] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [iso, setIso] = useState<BuiltCreditTransfer | null>(null);

  const ibanValid = transferType !== 'bicec' || isValidIban(recipient);
  const bicValid = isValidBic(creditorBic);
  const detailsValid = useMemo(() => {
    if (!recipient || !amount) return false;
    if (transferType === 'bicec') return ibanValid && bicValid && creditorName.length > 0;
    return true;
  }, [recipient, amount, transferType, ibanValid, bicValid, creditorName]);

  const handleSelectType = (type: TransferType) => {
    setTransferType(type);
    setStep('details');
  };

  const handleConfirm = async () => {
    if (pin.length !== 6) return;
    setLoading(true);

    // Try backend API first
    try {
      const res = await apiClient.post<{ transfer: { id: string }; iso_preview: BuiltCreditTransfer }, {
        transfer_type: TransferType;
        amount: number;
        currency: string;
        creditor_name: string;
        creditor_iban?: string;
        creditor_bic?: string;
        creditor_phone?: string;
        motif?: string;
      }>('/banking/transfers/send', {
        transfer_type: transferType!,
        amount: parseInt(amount || '0', 10),
        currency: 'XAF',
        creditor_name: creditorName || recipient,
        creditor_iban: transferType === 'bicec' ? recipient.replace(/\s/g, '') : undefined,
        creditor_bic: creditorBic || undefined,
        creditor_phone: transferType === 'mobile' ? recipient : undefined,
        motif: motif || undefined,
      });
      setIso(res.iso_preview);
      setLoading(false);
      setStep('success');
      return;
    } catch {
      // Fallback to client-side ISO generation
    }

    await new Promise(r => setTimeout(r, 1500));

    const built = buildPacs008({
      debtorName: 'Marie NGUEMO',
      debtorIban: 'CM2110001000231234567890142',
      debtorBic: 'BICECMCX',
      creditorName: creditorName || recipient,
      creditorIban: transferType === 'bicec' ? recipient.replace(/\s/g, '') : `CM00MOBILE${recipient.replace(/\D/g, '').padStart(20, '0')}`.slice(0, 34),
      creditorBic: creditorBic || undefined,
      amount: parseInt(amount || '0', 10),
      currency: 'XAF',
      remittance: motif,
      scheme: transferType === 'bicec' ? 'XAF-RTGS' : 'MOBILE',
    });
    setIso(built);
    setLoading(false);
    setStep('success');
  };

  const formatAmount = (val: string) => {
    const num = val.replace(/\D/g, '');
    return num ? parseInt(num).toLocaleString('fr-FR') : '';
  };

  if (step === 'success') {
    return (
      <ScreenLayout>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('transfer.success.title')}</h2>
          <p className="text-slate-500 text-sm mb-2">
            {formatAmount(amount)} XAF → {creditorName || recipient}
          </p>
          {iso && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 w-full max-w-sm text-left mb-6 mt-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">{t('transfer.iso.scheme')}</span><span className="font-mono">{iso.scheme}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('transfer.iso.endToEnd')}</span><span className="font-mono truncate ml-2">{iso.endToEndId}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('transfer.iso.msgId')}</span><span className="font-mono truncate ml-2">{iso.msgId}</span></div>
              </div>
              <button
                onClick={() => downloadIsoXml(`pacs008-${iso.endToEndId}.xml`, iso.xml)}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary py-2 text-xs font-semibold active:scale-95 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                {t('transfer.iso.download')}
              </button>
            </div>
          )}
          <button onClick={() => navigate('/dashboard')} className="w-full max-w-sm h-14 rounded-2xl bg-primary text-white text-base font-semibold active:scale-95 transition-all">
            {t('transfer.success.back')}
          </button>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout showBack title={t('transfer.send.title')}>
      <div className="flex-1 flex flex-col justify-between pt-4">
        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-slate-500 text-sm mb-2">{t('transfer.send.chooseType')}</p>
            {[
              { type: 'bicec' as const, icon: Building2, label: t('transfer.send.bicec'), desc: t('transfer.send.bicecDesc') },
              { type: 'mobile' as const, icon: Smartphone, label: t('transfer.send.mobile'), desc: t('transfer.send.mobileDesc') },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => handleSelectType(item.type)}
                className="w-full bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-all text-left"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {transferType === 'bicec' ? t('transfer.iso.iban') : t('transfer.send.phoneNumber')}
              </label>
              <input
                value={recipient}
                onChange={(e) => setRecipient(transferType === 'bicec' ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={transferType === 'bicec' ? 'CM21 10001 00023 12345678901 42' : 'Ex: 6 99 00 00 00'}
                className="w-full h-14 rounded-xl border border-slate-200 px-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                inputMode={transferType === 'mobile' ? 'tel' : 'text'}
              />
              {transferType === 'bicec' && recipient.length > 4 && !ibanValid && (
                <p className="text-xs text-red-500 mt-1">{t('transfer.iso.invalidIban')}</p>
              )}
            </div>
            {transferType === 'bicec' && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">{t('transfer.iso.name')}</label>
                  <input value={creditorName} onChange={(e) => setCreditorName(e.target.value)} placeholder="John Doe" className="w-full h-14 rounded-xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">{t('transfer.iso.bic')}</label>
                  <input value={creditorBic} onChange={(e) => setCreditorBic(e.target.value.toUpperCase())} placeholder="BICECMCX" className="w-full h-14 rounded-xl border border-slate-200 px-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">{t('transfer.send.amount')}</label>
              <div className="relative">
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="w-full h-14 rounded-xl border border-slate-200 px-4 text-base pr-16 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" inputMode="numeric" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">XAF</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">{t('transfer.send.motif')}</label>
              <input value={motif} onChange={(e) => setMotif(e.target.value.slice(0, 140))} placeholder={t('transfer.send.motifPlaceholder')} className="w-full h-14 rounded-xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <button onClick={() => setStep('confirm')} disabled={!detailsValid} className="w-full h-14 rounded-2xl bg-primary text-white text-base font-semibold disabled:opacity-40 active:scale-95 transition-all">
              {t('common.continue')}
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">{t('transfer.send.summary')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{t('transfer.send.to')}</span>
                  <span className="font-medium text-slate-800">{recipient}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{t('transfer.send.amount')}</span>
                  <span className="font-bold text-slate-800">{formatAmount(amount)} FCFA</span>
                </div>
                {motif && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{t('transfer.send.motif')}</span>
                    <span className="text-slate-600">{motif}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
                  <span className="text-slate-400">{t('transfer.send.fees')}</span>
                  <span className="text-emerald-500 font-medium">0 FCFA</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">{t('transfer.send.enterPin')}</label>
              <div className="flex justify-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn(
                    'h-4 w-4 rounded-full transition-all',
                    i < pin.length ? 'bg-primary scale-110' : 'bg-slate-200',
                  )} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6 max-w-[240px] mx-auto">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
                  <button key={i} onClick={() => {
                    if (d === '⌫') setPin(pin.slice(0, -1));
                    else if (d && pin.length < 6) setPin(pin + d);
                  }} className={cn('h-12 rounded-xl text-lg font-semibold bg-white border border-slate-100 active:scale-95 transition-all', d === '' && 'invisible')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleConfirm} disabled={pin.length !== 6 || loading} className="w-full h-14 rounded-2xl bg-primary text-white text-base font-semibold disabled:opacity-40 active:scale-95 transition-all">
              {loading ? '...' : t('common.confirm')}
            </button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}
