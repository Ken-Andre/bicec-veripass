import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Edit2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import type { OcrField } from '../../types';

export default function OcrReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setOcrFields, completeStep, setCurrentStep } = useKyc();
  const [fields, setFields] = useState<OcrField[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentStep('ocr_review');
    let mounted = true;
    const fetchOcr = async () => {
      try {
        const res = await apiClient.get<Record<string, unknown>>('/kyc/session/current');
        if (!mounted) return;

        const data = res.data as Record<string, any> | undefined;
        const documents = (data?.documents || res.documents) as { doc_type: string; ocr_fields?: { field_name: string; extracted_value: string; confidence_score: number }[] }[] | undefined;
        const cniDoc = documents?.find(d => d.doc_type === 'CNI_RECTO');

        if (cniDoc?.ocr_fields && cniDoc.ocr_fields.length > 0) {
          const mappedFields: OcrField[] = cniDoc.ocr_fields.map(f => ({
            field_name: f.field_name,
            value: f.extracted_value,
            confidence: f.confidence_score,
            editable: true
          }));
          setFields(mappedFields);
        } else {
          const mockFields = [
            { field_name: 'nom', value: 'NGUEMO', confidence: 0.95, editable: false },
            { field_name: 'prenom', value: 'Marie Claire', confidence: 0.92, editable: false },
            { field_name: 'sexe', value: 'F', confidence: 0.98, editable: false },
            { field_name: 'date_naissance', value: '15/03/1992', confidence: 0.88, editable: true },
            { field_name: 'lieu_naissance', value: 'Douala', confidence: 0.72, editable: true },
            { field_name: 'profession', value: 'Ingénieur', confidence: 0.84, editable: true },
            { field_name: 'pere', value: 'NGUEMO Jean', confidence: 0.65, editable: true },
            { field_name: 'mere', value: 'FOTSO Elise', confidence: 0.68, editable: true },
            { field_name: 'numero_cni', value: '123456789', confidence: 0.96, editable: false },
            { field_name: 'numero_unique', value: '10987654321', confidence: 0.91, editable: false },
            { field_name: 'date_delivrance', value: '15/03/2022', confidence: 0.80, editable: true },
            { field_name: 'date_expiration', value: '15/03/2032', confidence: 0.45, editable: true },
            { field_name: 'autorite', value: 'Martin DGSN', confidence: 0.70, editable: true },
          ];
          setFields(mockFields);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("OCR Fetch failed:", err);
        // Mock data fallback if HTTP error
        const mockFields = [
          { field_name: 'nom', value: 'NGUEMO', confidence: 0.95, editable: false },
          { field_name: 'prenom', value: 'Marie Claire', confidence: 0.92, editable: false },
          { field_name: 'sexe', value: 'F', confidence: 0.98, editable: false },
          { field_name: 'date_naissance', value: '15/03/1992', confidence: 0.88, editable: true },
          { field_name: 'lieu_naissance', value: 'Douala', confidence: 0.72, editable: true },
          { field_name: 'profession', value: 'Ingénieur', confidence: 0.84, editable: true },
          { field_name: 'pere', value: 'NGUEMO Jean', confidence: 0.65, editable: true },
          { field_name: 'mere', value: 'FOTSO Elise', confidence: 0.68, editable: true },
          { field_name: 'numero_cni', value: '123456789', confidence: 0.96, editable: false },
          { field_name: 'numero_unique', value: '10987654321', confidence: 0.91, editable: false },
          { field_name: 'date_delivrance', value: '15/03/2022', confidence: 0.80, editable: true },
          { field_name: 'date_expiration', value: '15/03/2032', confidence: 0.45, editable: true },
          { field_name: 'autorite', value: 'Martin DGSN', confidence: 0.70, editable: true },
        ];
        setFields(mockFields);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchOcr();
    return () => { mounted = false; };
  }, [setCurrentStep]);

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.85) return '🟢';
    if (score >= 0.5) return '🟠';
    return '🔴';
  };

  const handleSubmit = async () => {
    try {
      const corrections: Record<string, string> = {};

      const updatedFields = fields.map(f => {
        const newValue = editedValues[f.field_name];
        if (newValue !== undefined && newValue !== f.value) {
          corrections[f.field_name] = newValue;
          return { ...f, value: newValue, confidence: Math.max(f.confidence, 0.86) };
        }
        return f;
      });

      if (Object.keys(corrections).length > 0) {
        await apiClient.post('/kyc/ocr/review', { fields: corrections });
      }

      setOcrFields(updatedFields);
      completeStep('ocr_review');
      navigate('/kyc/liveness');
    } catch {
      // In case of error (e.g. mock API), still complete step for now
      const updatedFields = fields.map(f => {
        const newValue = editedValues[f.field_name];
        if (newValue !== undefined && newValue !== f.value) {
          return { ...f, value: newValue, confidence: Math.max(f.confidence, 0.86) };
        }
        return f;
      });
      setOcrFields(updatedFields);
      completeStep('ocr_review');
      navigate('/kyc/liveness');
    }
  };

  if (loading) {
    return (
      <ScreenLayout title={t('ocr.review.title')} showBack>
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title={t('ocr.review.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('ocr.processing.subtitle')}
        </p>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.field_name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 transition-all duration-300">
              <span className="text-lg">{getConfidenceBadge(field.confidence)}</span>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground capitalize">{field.field_name.replace('_', ' ')}</p>
                {editing === field.field_name ? (
                  <input
                    type="text"
                    value={editedValues[field.field_name] ?? field.value}
                    onChange={(e) => setEditedValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 rounded border-2 border-primary bg-background text-sm focus:outline-none"
                    autoFocus
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <p className={`text-sm font-medium ${getConfidenceColor(field.confidence)}`}>
                    {editedValues[field.field_name] ?? field.value}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditing(field.field_name)}
                className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                disabled={field.confidence >= 0.85 && !field.editable}
              >
                <Edit2 className={`w-4 h-4 ${field.confidence >= 0.85 && !field.editable ? 'text-muted-foreground/50' : 'text-primary'}`} />
              </button>
              <span className={`text-xs ${getConfidenceColor(field.confidence)}`}>
                {Math.round(field.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="w-full h-14 rounded-2xl text-base font-semibold gradient-primary border-0 mt-6 shadow-lg shadow-primary/20 text-white"
        >
          {t('common.continue')}
        </button>
      </div>
    </ScreenLayout>
  );
}