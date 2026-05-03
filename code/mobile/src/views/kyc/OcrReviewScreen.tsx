import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { ConfidenceBadge } from '../../components/ConfidenceBadge';
import { ProgressStepper } from '../../components/ProgressStepper';
import { OcrFieldsSkeleton } from '../../components/Skeleton';
import { Edit2, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { captureKycException } from '../../services/sentry';

const KYC_STEPS = [
  { label: 'CNI' },
  { label: 'OCR' },
  { label: 'Visage' },
  { label: 'Adresse' },
  { label: 'Facture' },
  { label: 'NIU' },
  { label: 'Consent.' },
  { label: 'Signature' },
  { label: 'Revue' },
];

type OcrField = {
  field_name: string;
  value: string;
  confidence: number;
  editable: boolean;
};

type FetchState = 'loading' | 'error' | 'success';

const RETRY_DELAYS = [2000, 4000, 8000];
const MAX_RETRIES = 3;

export default function OcrReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setOcrFields, completeStep, setCurrentStep, sessionId } = useKyc();

  const [fields, setFields] = useState<OcrField[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [userEditThreshold, setUserEditThreshold] = useState(0.95);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [docStatuses, setDocStatuses] = useState<Record<string, string>>({});

  const mountedRef = useRef(true);

  const getFieldLabel = (fieldName: string) => {
    const translated = t(`ocr.field.${fieldName}`);
    if (translated !== `ocr.field.${fieldName}`) return translated;
    return fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const fetchThresholds = async () => {
    try {
      const res = await apiClient.get<Record<string, unknown>>('/ocr/config/thresholds');
      if (mountedRef.current && res) {
        setUserEditThreshold((res.user_edit_threshold as number) ?? 0.95);
      }
    } catch (err) {
      console.warn('Failed to fetch OCR thresholds:', err);
    }
  };

  const fetchOcrWithRetry = async (attempt: number): Promise<void> => {
    if (!mountedRef.current) return;

    try {
      setLoading(true);
      setStatusMessage(
        t('ocr.loading.text') || 'Analyse de votre document...'
      );
      setFetchState('loading');

      const sessionRes = await apiClient.get<Record<string, unknown>>('/kyc/session/current', {
        timeout: 15000,
      });
      if (!mountedRef.current) return;

      const sessionData = (sessionRes.data ?? sessionRes) as Record<string, unknown>;
      const documents = (sessionData.documents || []) as Record<string, unknown>[];

      const allOcrFields: Record<string, unknown>[] = [];
      const docStatusMap: Record<string, string> = {};
      for (const doc of documents) {
        docStatusMap[doc.doc_type as string] = (doc.ocr_status as string) || 'PENDING';

        const isCni = doc.doc_type === 'CNI_RECTO' || doc.doc_type === 'CNI_VERSO';
        const isBill = doc.doc_type === 'BILL_ENEO' || doc.doc_type === 'BILL_CAMWATER';
        if (isCni || isBill) {
          const docFields = (doc.ocr_fields || []) as Record<string, unknown>[];
          for (const f of docFields) {
            if (!allOcrFields.some((existing) => existing.field_name === f.field_name)) {
              allOcrFields.push({ ...f, _docType: doc.doc_type, _ocrStatus: doc.ocr_status });
            }
          }
        }
      }

      if (allOcrFields.length === 0) {
        setStatusMessage(null);
        setFields([]);
        setFetchState('success');
        setLoading(false);
        return;
      }

      const extractedFields: OcrField[] = allOcrFields.map((f) => ({
        field_name: f.field_name as string,
        value: (f.extracted_value || f.corrected_value || '') as string,
        confidence: (f.confidence_score as number) ?? 0,
        editable:
          f.human_corrected ? true : ((f.confidence_score as number) ?? 0) < userEditThreshold,
      }));

      setStatusMessage(null);
      setFields(extractedFields);
      setFetchState('success');
      setDocStatuses(docStatusMap);
      setOcrFields(extractedFields);
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      const isTimeout = (err as Error).name === 'AbortError' || (err as { code?: string }).code === 'ECONNABORTED';
      const errMsg = err instanceof Error ? err.message : String(err);
      const isServerError =
        errMsg.includes('503') ||
        errMsg.includes('504') ||
        errMsg.includes('500') ||
        errMsg.includes('Service Unavailable') ||
        errMsg.includes('Gateway Time-out') ||
        errMsg.includes('Internal Server Error');
      const isSessionExpired =
        errMsg.includes('Session expirée') ||
        errMsg.includes('401');

      if (isSessionExpired) {
        setFetchState('error');
        setStatusMessage(
          t('ocr.error.session_expired') ||
          'Votre session a expiré. Veuillez vous reconnecter.'
        );
        return;
      }

      if (attempt < MAX_RETRIES && (isTimeout || isServerError)) {
        const delay = RETRY_DELAYS[attempt] ?? 8000;
        setRetryCount(attempt + 1);
        setStatusMessage(
          `${t('ocr.loading.retry') || 'Nouvelle tentative'} (${attempt + 1}/${MAX_RETRIES})...`
        );
        await new Promise((r) => setTimeout(r, delay));
        return fetchOcrWithRetry(attempt + 1);
      }

      console.warn('OCR fetch failed, using manual entry:', err);
      setStatusMessage(
        isServerError
          ? (t('ocr.error.server_error') || 'Le serveur est temporairement saturé ou inaccessible.')
          : (t('ocr.manual_entry') || 'Saisissez vos informations manuellement')
      );
      setFetchState('error');

      const fallbackFields: OcrField[] = [
        'nom', 'prenom', 'date_naissance', 'lieu_naissance', 'sexe', 'taille',
        'profession', 'numero_cni', 'date_delivrance', 'date_expiration',
        'adresse', 'poste_identification',
      ].map((name) => ({
        field_name: name,
        value: '',
        confidence: 0,
        editable: true,
      }));

      setFields(fallbackFields);

      captureKycException(err, 'ocr_failure', {
        sessionId,
        step: 'ocr_review',
        operation: 'ocr_fetch',
        extra: { retryCount: attempt, error: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentStep('ocr_review');
    mountedRef.current = true;

    fetchThresholds();
    fetchOcrWithRetry(0);

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCurrentStep, t, sessionId]);

  const handleSubmit = async () => {
    try {
      const corrections: Record<string, string> = {};

      const updatedFields = fields.map((f) => {
        const newValue = editedValues[f.field_name];
        if (newValue !== undefined && newValue !== f.value) {
          corrections[f.field_name] = newValue;
          return { ...f, value: newValue, confidence: Math.max(f.confidence, 0.95) };
        }
        return f;
      });

      if (Object.keys(corrections).length > 0) {
        await apiClient.post('/kyc/ocr/confirm', { corrected_fields: corrections });
      }

      setOcrFields(updatedFields);
      completeStep('ocr_review');
      navigate('/kyc/biometric-consent');
    } catch (err) {
      console.error('Submission failed:', err);
      captureKycException(err, 'ocr_failure', {
        sessionId,
        step: 'ocr_review',
        operation: 'ocr_confirm_submit',
        extra: { corrected_fields_count: Object.keys(editedValues).length },
      });
      completeStep('ocr_review');
      navigate('/kyc/biometric-consent');
    }
  };

  if (loading) {
    return (
      <ScreenLayoutV2 title={t('ocr.review.title')} showBack>
        <ProgressStepper steps={KYC_STEPS} currentStep={1} className="mb-4" />
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">
              {statusMessage || t('ocr.loading.text') || 'Analyse de votre document...'}
            </p>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground pl-6">
              Tentative {retryCount}/{MAX_RETRIES}
            </p>
          )}
        </div>
        <OcrFieldsSkeleton />
      </ScreenLayoutV2>
    );
  }

  return (
    <ScreenLayoutV2 title={t('ocr.review.title')} showBack>
      <ProgressStepper steps={KYC_STEPS} currentStep={1} className="mb-4" />
      <div className="flex flex-col gap-6 py-2">
        {fetchState === 'error' && statusMessage && (
          <div className="bg-destructive/10 p-4 rounded-2xl border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-destructive font-bold">{statusMessage}</p>
                <div className="flex gap-4 mt-3">
                  <button
                    onClick={() => {
                      setLoading(true);
                      fetchOcrWithRetry(0);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-card px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive shadow-sm active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('common.retry') || 'Réessayer'}
                  </button>
                  <button
                    onClick={() => setStatusMessage(null)}
                    className="text-xs font-bold text-destructive underline underline-offset-2"
                  >
                    {t('ocr.error.skip_to_manual') || 'Saisie manuelle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {fetchState === 'success' && statusMessage && (
          <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20">
            <p className="text-sm text-warning font-medium">{statusMessage}</p>
          </div>
        )}

        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-sm text-primary font-medium">
            {t('ocr.processing.subtitle') ||
              'Vérifiez les informations extraites de votre CNI'}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(docStatuses).map(([docType, status]) => {
              const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                SUCCESS: { bg: 'bg-success/20', text: 'text-success', label: '✓' },
                PARTIAL: { bg: 'bg-warning/20', text: 'text-warning', label: '~' },
                FAILED: { bg: 'bg-destructive/20', text: 'text-destructive', label: '✗' },
                PENDING: { bg: 'bg-muted', text: 'text-muted-foreground', label: '…' },
              };
              const cfg = statusConfig[status] || statusConfig.PENDING;
              const shortName = docType.replace('BILL_', '').replace('CNI_', 'CNI ');
              return (
                <span key={docType} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                  {cfg.label} {shortName}
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune donnée OCR disponible.</p>
              <p className="text-sm mt-2">
                Veuillez saisir vos informations manuellement.
              </p>
            </div>
          ) : (
            fields.map((field) => {
              const currentValue = editedValues[field.field_name] ?? field.value;
              const isEditing = editing === field.field_name;

              return (
                <div key={field.field_name} className="group flex flex-col gap-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {getFieldLabel(field.field_name)}
                    </label>
                    <ConfidenceBadge confidence={field.confidence} />
                  </div>

                  <div
                    className={`relative flex items-center p-3 rounded-xl border-2 transition-all duration-200 ${isEditing
                      ? 'border-primary ring-4 ring-primary/10 bg-background'
                      : 'border-muted/20 bg-muted/30 group-hover:border-muted/40'
                      }`}
                  >
                    {isEditing || field.editable ? (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) =>
                          setEditedValues((prev) => ({
                            ...prev,
                            [field.field_name]: e.target.value,
                          }))
                        }
                        className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                        autoFocus
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditing(null);
                        }}
                      />
                    ) : (
                      <div
                        className="flex-1 flex items-center justify-between cursor-pointer"
                        onClick={() =>
                          field.editable && setEditing(field.field_name)
                        }
                      >
                        <span
                          className={`text-sm font-semibold ${!currentValue
                            ? 'text-destructive italic'
                            : 'text-foreground'
                            }`}
                        >
                          {currentValue || 'À compléter'}
                        </span>
                        {field.editable && (
                          <Edit2 className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 pb-10">
          <Button onClick={handleSubmit}>
            {t('common.continue')}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-4 px-6">
            En continuant, vous confirmez que les informations ci-dessus
            correspondent exactement à votre pièce d'identité officielle.
          </p>
        </div>
      </div>
    </ScreenLayoutV2>
  );
}
