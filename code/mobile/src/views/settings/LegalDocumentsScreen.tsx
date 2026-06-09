import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchLegalDocuments, type LegalDocument } from '../../services/legalDocuments';

export default function LegalDocumentsScreen() {
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const label = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  useEffect(() => {
    let mounted = true;
    const loadDocuments = async () => {
      await Promise.resolve();
      if (!mounted) return;
      setLoading(true);
      setError('');
      try {
        const items = await fetchLegalDocuments(language);
        if (mounted) setDocuments(items);
      } catch {
        if (mounted) {
          const translated = t('legal.unavailable');
          setError(translated === 'legal.unavailable' ? 'Documents indisponibles.' : translated);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadDocuments();
    return () => {
      mounted = false;
    };
  }, [language, t]);

  return (
    <ScreenLayoutV2 showBack title={label('legal.title', 'Documents legaux')} contentClassName="pb-32">
      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">{label('common.loading', 'Chargement...')}</p>}
        {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

        {(activeDocument ? [activeDocument] : documents).map((document) => (
          <article key={document.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">{document.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Version {document.version}</p>
                {activeDocument ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">{document.content}</p>
                ) : (
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-primary"
                    onClick={() => setActiveDocument(document)}
                  >
                    {label('consent.readDoc', 'Lire le document')}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}

        {activeDocument && (
          <button
            type="button"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground"
            onClick={() => setActiveDocument(null)}
          >
            {label('common.back', 'Retour')}
          </button>
        )}
      </div>
    </ScreenLayoutV2>
  );
}
