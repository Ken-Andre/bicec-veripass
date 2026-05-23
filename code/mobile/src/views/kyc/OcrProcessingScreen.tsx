import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Loader2 } from 'lucide-react';

export default function OcrProcessingScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const timer = setTimeout(() => {
      if (!cancelledRef.current) {
        navigate('/kyc/ocr-review');
      }
    }, 3000);
    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <ScreenLayoutV2>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-12">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
            style={{ animationDuration: '2s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            {t('ocr.processing.title') || 'Analyse en cours...'}
          </h2>
          <p className="text-muted-foreground max-w-xs mx-auto">
            {t('ocr.processing.subtitle') || 'Nous lisons les informations de votre CNI. Cela ne prendra que quelques instants.'}
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
