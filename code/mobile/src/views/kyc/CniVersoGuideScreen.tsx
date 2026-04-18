import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Button } from '../../components/ui/button';
import { RotateCw, Camera } from 'lucide-react';

export default function CniVersoGuideScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <ScreenLayout showBack title={t('cni.verso.title')}>
      <div className="flex-1 flex flex-col items-center justify-between pt-12 pb-6">
        <div className="text-center">
          <div className="mb-8">
            <div className="mx-auto flex h-28 w-44 items-center justify-center rounded-2xl bg-primary/10 border-2 border-dashed border-primary/30">
              <RotateCw className="h-10 w-10 text-primary/50" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">{t('cni.verso.flip')}</h2>
          <p className="text-muted-foreground text-sm">{t('cni.verso.tip')}</p>
        </div>
        <Button 
          onClick={() => navigate('/kyc/cni-verso-capture')} 
          className="w-full h-14 rounded-xl text-base font-semibold bg-primary text-primary-foreground"
        >
          <Camera className="w-5 h-5 mr-2" />
          {t('capture.open.camera')}
        </Button>
      </div>
    </ScreenLayout>
  );
}
