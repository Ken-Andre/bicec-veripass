import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { CheckCircle, FileText, User, MapPin, Shield, Loader2 } from 'lucide-react';

interface SessionData {
  status: string;
  documents: { doc_type: string }[];
  consent_record: { cgu_accepted: boolean } | null;
}

export default function ReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/kyc/session/current', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        }
      } catch {}
    };
    fetchSession();
  }, []);

  const docTypes = session?.documents?.map(d => d.doc_type) || [];
  const hasCni = docTypes.includes('CNI_RECTO') && docTypes.includes('CNI_VERSO');
  const hasSelfie = docTypes.includes('SELFIE');
  const hasBill = docTypes.some(d => d.startsWith('BILL_'));
  const hasConsent = session?.consent_record?.cgu_accepted;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/kyc/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenLayout title={t('celebration.title')}>
        <div className="flex flex-col items-center gap-6 py-12">
          <CheckCircle className="w-20 h-20 text-green-500" />
          <h2 className="text-2xl font-bold text-center">{t('celebration.title')}</h2>
          <p className="text-muted-foreground text-center">{t('celebration.message')}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full max-w-sm bg-primary text-primary-foreground py-3 rounded-lg font-medium"
          >
            {t('common.continue')}
          </button>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={t('review.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <h2 className="text-lg font-bold">{t('review.title')}</h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <User className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.identity')}</p>
              <p className="text-xs text-muted-foreground">
                {hasCni ? '✓ CNI recto/verso' : '✗ CNI manquant'}
                {hasSelfie ? ' · ✓ Selfie' : ' · ✗ Selfie manquant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.address')}</p>
              <p className="text-xs text-muted-foreground">
                {hasBill ? t('review.bill.yes') : t('review.bill.no')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">NIU</p>
              <p className="text-xs text-muted-foreground">
                {docTypes.includes('NIU') ? t('review.niu.yes') : t('review.niu.no')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('review.consent')}</p>
              <p className="text-xs text-muted-foreground">
                {hasConsent ? t('review.consent.cgu') : '✗ CGU non acceptées'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !hasCni || !hasSelfie || !hasConsent}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {t('review.submit')}
        </button>
      </div>
    </ScreenLayout>
  );
}