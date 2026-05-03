import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
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
    <ScreenLayoutV2 showBack title={t('receive.title')}>
      <div className="space-y-6 pt-2">
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center">
          <div className="h-40 w-40 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <QrCode className="h-20 w-20 text-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground">{t('receive.scanQr')}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="text-sm font-medium text-foreground font-mono">{field.value}</p>
              </div>
              <button onClick={() => handleCopy(field.label, field.value)} className="p-2 rounded-lg active:bg-muted transition-colors">
                {copied === field.label ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          ))}
        </div>

        <Button variant="secondary" onClick={() => handleCopy('iban-full', ribInfo.iban)}>
          <Copy className="h-4 w-4" />
          {t('receive.copyIban')}
        </Button>
      </div>
    </ScreenLayoutV2>
  );
}
