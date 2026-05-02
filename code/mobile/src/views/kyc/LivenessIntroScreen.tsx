import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Camera, Shield, ArrowRight } from 'lucide-react';

export default function LivenessIntroScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <ScreenLayout title={t('liveness.intro.title') || 'Vérification de vie'} showBack>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <Camera className="w-12 h-12 text-primary" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800">
            {t('liveness.intro.title') || 'Vérification de vie'}
          </h2>
          <p className="text-muted-foreground max-w-xs mx-auto text-sm">
            {t('liveness.intro.subtitle') || 'Nous devons vérifier que vous êtes bien une personne réelle. Suivez les instructions à l\'écran.'}
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          {[
            { text: t('liveness.intro.step1') || 'Souriez naturellement' },
            { text: t('liveness.intro.step2') || 'Clignez des yeux' },
            { text: t('liveness.intro.step3') || 'Tournez la tête légèrement' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {i + 1}
              </div>
              <span className="text-sm text-slate-700">{step.text}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>{t('liveness.intro.privacy') || 'Votre selfie est traité de manière sécurisée.'}</span>
        </div>

        <button
          onClick={() => navigate('/kyc/liveness')}
          className="w-full max-w-sm flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
        >
          {t('liveness.intro.start') || 'Commencer la vérification'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </ScreenLayout>
  );
}
