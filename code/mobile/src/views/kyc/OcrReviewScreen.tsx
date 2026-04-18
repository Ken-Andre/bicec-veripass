import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Edit2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { captureKycException } from '../../services/sentry';

type OcrField = {
  field_name: string;
  value: string;
  confidence: number;
  editable: boolean;
};

type SessionDocument = {
  id: string;
  doc_type: string;
  ocr_engine?: string | null;
  file_path?: string;
};

export default function OcrReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setOcrFields, completeStep, setCurrentStep, sessionId } = useKyc();
  
  const [fields, setFields] = useState<OcrField[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.90);
  const [userEditThreshold, setUserEditThreshold] = useState(0.95);

  const getFieldLabel = (fieldName: string) => {
    const translated = t(`ocr.field.${fieldName}`);
    if (translated !== `ocr.field.${fieldName}`) return translated;
    return fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  useEffect(() => {
    setCurrentStep('ocr_review');
    let mounted = true;

    const fetchThresholds = async () => {
      try {
        const res = await apiClient.get<any>('/ocr/config/thresholds');
        if (mounted && res.data) {
          setThreshold(res.data.confidence_threshold ?? 0.90);
          setUserEditThreshold(res.data.user_edit_threshold ?? 0.95);
        }
      } catch (err) {
        console.warn('Failed to fetch OCR thresholds:', err);
      }
    };

    const fetchOcr = async () => {
      try {
        setStatusMessage(t('ocr.loading.text') || 'Analyse de votre document...');
        
        // Get current session to find CNI document
        const sessionRes = await apiClient.get<any>('/kyc/session/current');
        if (!mounted) return;

        const documents = (sessionRes.data?.documents || []) as SessionDocument[];
        const cniDoc = documents.find(d => d.doc_type === 'CNI_RECTO' || d.doc_type === 'CNI_VERSO');

        if (!cniDoc) {
          setStatusMessage(null);
          setFields([]);
          return;
        }

        // Call OCR extraction API for this document
        try {
          const ocrRes = await apiClient.post<any>(`/ocr/extract`, null, {
            params: { document_id: cniDoc.id }
          });

          if (!mounted) return;

          const ocrData = ocrRes.data;
          
          // Map API response to UI fields
          const extractedFields: OcrField[] = Object.entries(ocrData.fields || {}).map(
            ([fieldName, fieldData]: [string, any]) => ({
              field_name: fieldName,
              value: fieldData.value || '',
              confidence: fieldData.conf ?? 0,
              editable: ocrData.can_user_edit ?? (fieldData.conf < userEditThreshold),
            })
          );

          setStatusMessage(null);
          setFields(extractedFields);
          
          // Store in KycContext
          setOcrFields(extractedFields.map(f => ({
            field_name: f.field_name,
            extracted_value: f.value,
            confidence_score: f.confidence,
          })));

        } catch (ocrErr) {
          // If OCR extraction fails, show empty fields for manual entry
          console.warn('OCR extraction failed, using manual entry:', ocrErr);
          setStatusMessage(t('ocr.manual_entry') || 'Saisissez vos informations manuellement');
          
          const fallbackFields: OcrField[] = [
            'nom', 'prenom', 'date_naissance', 'lieu_naissance', 'sexe', 
            'taille', 'profession', 'numero_cni', 'date_delivrance', 
            'date_expiration', 'adresse', 'poste_identification'
          ].map(name => ({
            field_name: name,
            value: '',
            confidence: 0,
            editable: true,
          }));
          
          setFields(fallbackFields);
        }

      } catch (err) {
        if (!mounted) return;
        console.error('OCR Fetch failed:', err);
        captureKycException(err, 'ocr_failure', {
          sessionId,
          step: 'ocr_review',
          operation: 'ocr_fetch',
        });
        setStatusMessage(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchThresholds();
    fetchOcr();

    return () => { mounted = false; };
  }, [setCurrentStep, sessionId, t, setOcrFields, userEditThreshold]);

  const getConfidenceLevel = (score: number) => {
    if (score >= threshold) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  const getConfidenceUI = (score: number, editable: boolean) => {
    // Show warning if user can edit (confidence below threshold)
    if (editable) {
      return { color: 'text-orange-600', bg: 'bg-orange-100', icon: <AlertCircle className="w-3 h-3" /> };
    }
    
    const level = getConfidenceLevel(score);
    switch (level) {
      case 'high': return { color: 'text-green-600', bg: 'bg-green-100', icon: <ShieldCheck className="w-3 h-3" /> };
      case 'medium': return { color: 'text-orange-600', bg: 'bg-orange-100', icon: <AlertCircle className="w-3 h-3" /> };
      default: return { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle className="w-3 h-3" /> };
    }
  };

  const handleSubmit = async () => {
    try {
      const corrections: Record<string, string> = {};

      const updatedFields = fields.map(f => {
        const newValue = editedValues[f.field_name];
        if (newValue !== undefined && newValue !== f.value) {
          corrections[f.field_name] = newValue;
          return { ...f, value: newValue, confidence: Math.max(f.confidence, 0.95) };
        }
        return f;
      });

      if (Object.keys(corrections).length > 0) {
        await apiClient.post('/kyc/ocr/confirm', { fields: corrections });
      }

      setOcrFields(updatedFields.map(f => ({
        field_name: f.field_name,
        extracted_value: f.value,
        confidence_score: f.confidence,
      })));
      
      completeStep('ocr_review');
      navigate('/kyc/liveness');
    } catch (err) {
      console.error('Submission failed:', err);
      captureKycException(err, 'ocr_failure', {
        sessionId,
        step: 'ocr_review',
        operation: 'ocr_confirm_submit',
        extra: { corrected_fields_count: Object.keys(editedValues).length },
      });
      completeStep('ocr_review');
      navigate('/kyc/liveness');
    }
  };

  if (loading) {
    return (
      <ScreenLayout title={t('ocr.review.title')} showBack>
        <div className="flex-1 flex flex-col justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">{statusMessage || t('ocr.loading.text') || 'Analyse de votre document...'}</p>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={t('ocr.review.title')} showBack>
      <div className="flex flex-col gap-6 py-4">
        {statusMessage && (
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
            <p className="text-sm text-orange-700 font-medium">{statusMessage}</p>
          </div>
        )}

        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-sm text-primary font-medium">
            {t('ocr.processing.subtitle') || 'Vérifiez les informations extraites de votre CNI'}
          </p>
        </div>

        <div className="space-y-4">
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune donnée OCR disponible.</p>
              <p className="text-sm mt-2">Veuillez saisir vos informations manuellement.</p>
            </div>
          ) : (
            fields.map((field) => {
              const ui = getConfidenceUI(field.confidence, field.editable);
              const currentValue = editedValues[field.field_name] ?? field.value;
              const isEditing = editing === field.field_name;

              return (
                <div key={field.field_name} className="group flex flex-col gap-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {getFieldLabel(field.field_name)}
                    </label>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ui.bg} ${ui.color}`}>
                      {ui.icon}
                      {field.confidence > 0 ? `${Math.round(field.confidence * 100)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className={`relative flex items-center p-3 rounded-xl border-2 transition-all duration-200 ${isEditing ? 'border-primary ring-4 ring-primary/10 bg-background' : 'border-muted/20 bg-muted/30 group-hover:border-muted/40'}`}>
                    {isEditing || field.editable ? (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => setEditedValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                        className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                        autoFocus
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditing(null); }}
                      />
                    ) : (
                      <div
                        className="flex-1 flex items-center justify-between cursor-pointer"
                        onClick={() => field.editable && setEditing(field.field_name)}
                      >
                        <span className={`text-sm font-semibold ${!currentValue ? 'text-red-400 italic' : 'text-foreground'}`}>
                          {currentValue || 'À compléter'}
                        </span>
                        {field.editable && <Edit2 className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 pb-10">
          <button
            onClick={handleSubmit}
            className="w-full h-14 rounded-2xl text-base font-bold bg-primary text-white shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {t('common.continue')}
          </button>
          <p className="text-[11px] text-center text-muted-foreground mt-4 px-6">
            En continuant, vous confirmez que les informations ci-dessus correspondent exactement à votre pièce d'identité officielle.
          </p>
        </div>
      </div>
    </ScreenLayout>
  );
}