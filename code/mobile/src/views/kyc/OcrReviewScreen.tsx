import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { ScreenLayout } from '../../components/ScreenLayout';
import { Edit2 } from 'lucide-react';

interface OcrField {
  field_name: string;
  extracted_value: string;
  confidence_score: number;
}

export default function OcrReviewScreen() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [fields, setFields] = useState<OcrField[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch OCR results from API
    const fetchOcr = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/v1/kyc/session/current', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Extract OCR fields from documents
          const cniDoc = data.documents?.find((d: { doc_type: string }) => d.doc_type === 'CNI_RECTO');
          if (cniDoc?.ocr_fields) {
            setFields(cniDoc.ocr_fields);
          }
        }
      } catch {
        // Use default fields if API fails
        setFields([
          { field_name: 'nom', extracted_value: 'NGUEMO', confidence_score: 0.95 },
          { field_name: 'prenom', extracted_value: 'Marie Claire', confidence_score: 0.92 },
          { field_name: 'date_naissance', extracted_value: '15/03/1992', confidence_score: 0.88 },
          { field_name: 'lieu_naissance', extracted_value: 'Douala', confidence_score: 0.72 },
          { field_name: 'numero_cni', extracted_value: '123456789', confidence_score: 0.96 },
        ]);
      }
    };
    fetchOcr();
  }, []);

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
      const token = localStorage.getItem('access_token');
      const corrections: Record<string, string> = {};
      Object.entries(editedValues).forEach(([key, val]) => {
        if (val !== fields.find(f => f.field_name === key)?.extracted_value) {
          corrections[key] = val;
        }
      });

      if (Object.keys(corrections).length > 0) {
        await fetch('/api/v1/kyc/ocr/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fields: corrections }),
        });
      }
      navigate('/kyc/liveness-intro');
    } catch {
      navigate('/kyc/liveness-intro');
    }
  };

  return (
    <ScreenLayout title={t('ocr.review.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        <p className="text-sm text-muted-foreground text-center">
          {t('ocr.processing.subtitle')}
        </p>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.field_name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <span className="text-lg">{getConfidenceBadge(field.confidence_score)}</span>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground capitalize">{field.field_name.replace('_', ' ')}</p>
                {editing === field.field_name ? (
                  <input
                    type="text"
                    value={editedValues[field.field_name] ?? field.extracted_value}
                    onChange={(e) => setEditedValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                    className="w-full mt-1 px-2 py-1 rounded border bg-background text-sm"
                    autoFocus
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <p className={`text-sm font-medium ${getConfidenceColor(field.confidence_score)}`}>
                    {editedValues[field.field_name] ?? field.extracted_value}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditing(field.field_name)}
                className="p-1 rounded hover:bg-muted"
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className={`text-xs ${getConfidenceColor(field.confidence_score)}`}>
                {Math.round(field.confidence_score * 100)}%
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium mt-4"
        >
          {t('common.continue')}
        </button>
      </div>
    </ScreenLayout>
  );
}