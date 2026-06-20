import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';

export function TransferSendScreen() {
  const { t } = useLanguage();

  // =====================================================================
  // PRODUCTION SAFETY — Service de virement désactivé temporairement.
  // Le core banking est hors périmètre. À réactiver uniquement après
  // intégration du backend banking et validation conformité.
  // =====================================================================

  return (
    <ScreenLayoutV2 showBack title={t('transfer.send.title')}>
      <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
          <span className="text-2xl">🚧</span>
        </div>
        <h2 className="text-lg font-bold text-foreground">Service en cours de déploiement</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Les virements seront disponibles prochainement. En attendant, vous pouvez compléter votre dossier KYC.
        </p>
      </div>
    </ScreenLayoutV2>
  );
}
