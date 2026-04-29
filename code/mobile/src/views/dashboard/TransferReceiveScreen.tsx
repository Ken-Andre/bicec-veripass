import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Copy, CheckCircle, QrCode } from 'lucide-react';

export function TransferReceiveScreen() {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);

  const ribInfo = {
    bank: '10001',
    branch: '00023',
    account: '12345678901',
    key: '42',
    iban: 'CM21 10001 00023 12345678901 42',
    bic: 'BICECMCX',
    holder: 'NGUEMO Marie Claire',
  };

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const fields = [
    { label: t('receive.holder'), value: ribInfo.holder },
    { label: 'IBAN', value: ribInfo.iban },
    { label: 'BIC / SWIFT', value: ribInfo.bic },
    { label: t('receive.bankCode'), value: ribInfo.bank },
    { label: t('receive.branchCode'), value: ribInfo.branch },
    { label: t('receive.accountNumber'), value: ribInfo.account },
    { label: t('receive.key'), value: ribInfo.key },
  ];

  return (
    <ScreenLayout showBack title={t('receive.title')}>
      <div className="space-y-6 pt-2">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col items-center">
          <div className="h-40 w-40 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <QrCode className="h-20 w-20 text-slate-300" />
          </div>
          <p className="text-xs text-slate-400">{t('receive.scanQr')}</p>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">{field.label}</p>
                <p className="text-sm font-medium text-slate-800 font-mono">{field.value}</p>
              </div>
              <button onClick={() => handleCopy(field.label, field.value)} className="p-2 rounded-lg active:bg-slate-100 transition-colors">
                {copied === field.label ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-400" />
                )}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => handleCopy('iban-full', ribInfo.iban)}
          className="w-full h-12 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Copy className="h-4 w-4" />
          {t('receive.copyIban')}
        </button>
      </div>
    </ScreenLayout>
  );
}
