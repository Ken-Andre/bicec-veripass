import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Button } from '../../components/ui/button';
import { Sun, Hand, Focus, Camera } from 'lucide-react';

export default function CniRectoGuideScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tips = [
    { icon: Sun, text: t('capture.tip.light') },
    { icon: Hand, text: t('capture.tip.steady') },
    { icon: Focus, text: t('capture.tip.align') },
  ];

  return (
    <ScreenLayout showBack title={t('cni.recto.title')}>
      <div className="flex-1 flex flex-col items-center justify-between pt-8 pb-6">
        <div className="text-center">
          <div className="mb-8">
            <div className="mx-auto h-40 w-64 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center bg-primary/5">
              <p className="text-primary/60 text-sm font-medium text-center px-4">
                {t('cni.recto.placeholder')}
              </p>
            </div>
          </div>
          <div className="space-y-4 max-w-xs mx-auto">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <tip.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-foreground text-left">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
        <Button 
          onClick={() => navigate('/kyc/cni-recto-capture')} 
          className="w-full h-14 rounded-xl text-base font-semibold bg-primary text-primary-foreground"
        >
          <Camera className="w-5 h-5 mr-2" />
          {t('capture.open.camera')}
        </Button>
      </div>
    </ScreenLayout>
  );
}
