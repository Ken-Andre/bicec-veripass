import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronRight, Phone, FileText } from 'lucide-react';

const faqItems = [
  { q: { fr: 'Comment ouvrir un compte ?', en: 'How to open an account?' }, a: { fr: 'Téléchargez l\'app et suivez les étapes de vérification KYC.', en: 'Download the app and follow the KYC verification steps.' } },
  { q: { fr: 'Combien de temps prend la vérification ?', en: 'How long does verification take?' }, a: { fr: '24 à 48 heures ouvrées après soumission du dossier.', en: '24 to 48 business days after submission.' } },
  { q: { fr: 'Comment activer la biométrie ?', en: 'How to enable biometrics?' }, a: { fr: 'Allez dans Paramètres > Biométrie et suivez les instructions.', en: 'Go to Settings > Biometrics and follow the instructions.' } },
  { q: { fr: 'Mes données sont-elles sécurisées ?', en: 'Is my data secure?' }, a: { fr: 'Oui, toutes les données sont chiffrées et conformes COBAC.', en: 'Yes, all data is encrypted and COBAC compliant.' } },
];

export function HelpScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <ScreenLayout showBack title={t('help.title')}>
      <div className="space-y-6 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/support')} className="bg-primary/10 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-all">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="text-xs font-semibold text-primary">{t('help.chat')}</span>
          </button>
          <a href="tel:+237612345678" className="bg-emerald-50 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-all">
            <Phone className="h-6 w-6 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600">{t('help.call')}</span>
          </a>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              {t('help.faq')}
            </h3>
          </div>
          {faqItems.map((item, i) => (
            <details key={i} className="border-b border-slate-50 last:border-0">
              <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors list-none flex items-center justify-between">
                {t('help.language') === 'fr' ? item.q.fr : item.q.en}
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 transition-transform open:rotate-90" />
              </summary>
              <div className="px-4 pb-3 text-xs text-slate-500 leading-relaxed">
                {t('help.language') === 'fr' ? item.a.fr : item.a.en}
              </div>
            </details>
          ))}
        </div>
      </div>
    </ScreenLayout>
  );
}
