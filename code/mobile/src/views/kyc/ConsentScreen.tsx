import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useKyc } from '../../contexts/KycContext';
import { ScreenLayoutV2 } from '../../components/ui/ScreenLayoutV2';
import { Button } from '../../components/ui/button';
import { fetchWithCorrelation } from '../../services/apiClient';
import { enqueueOfflineConsent } from '../../services/kycSyncService';
import {
  fetchLegalDocuments,
  toAcceptedLegalDocument,
  type LegalDocument,
  type LegalDocumentKey,
} from '../../services/legalDocuments';
import { CheckSquare, Square, FileText, X } from 'lucide-react';

type ConsentKey = 'cgu' | 'privacy' | 'data';

type Consents = Record<ConsentKey, boolean>;

const CONSENT_TO_DOCUMENT_KEY: Record<ConsentKey, LegalDocumentKey> = {
  cgu: 'cgu',
  privacy: 'privacy',
  data: 'data_processing',
};

function ConsentRow({
  keyName,
  title,
  showDoc = false,
  document,
  checked,
  onToggle,
  onRead,
  t,
}: {
  keyName: ConsentKey;
  title: string;
  showDoc?: boolean;
  document?: LegalDocument;
  checked: boolean;
  onToggle: (key: ConsentKey) => void;
  onRead: (document?: LegalDocument) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      data-testid="consent-row"
      className="relative flex items-start gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onToggle(keyName)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle(keyName);
        }
      }}
    >
      <button
        type="button"
        className="flex items-center justify-center"
        aria-pressed={checked}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(keyName);
        }}
      >
        {checked ? (
          <CheckSquare className="w-6 h-6 text-primary shrink-0" />
        ) : (
          <Square className="w-6 h-6 text-muted-foreground shrink-0" />
        )}
      </button>
      <div className="text-left flex-1">
        <button
          type="button"
          className="block w-full text-left font-medium text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(keyName);
          }}
        >
          {title}
        </button>
        {showDoc && (
          <button
            type="button"
            className="text-xs text-muted-foreground flex items-center gap-1 mt-1"
            onClick={(event) => {
              event.stopPropagation();
              onRead(document);
            }}
          >
            <FileText className="w-3 h-3" /> {t('consent.readDoc')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConsentScreen() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { completeStep, sessionId, setSessionId } = useKyc();
  const [consents, setConsents] = useState<Consents>({ cgu: false, privacy: false, data: false });
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documentError, setDocumentError] = useState('');
  const [activeDocument, setActiveDocument] = useState<LegalDocument | null>(null);

  const label = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  useEffect(() => {
    let mounted = true;
    const loadDocuments = async () => {
      await Promise.resolve();
      if (!mounted) return;
      setLoadingDocs(true);
      setDocumentError('');
      try {
        const items = await fetchLegalDocuments(language);
        if (mounted) setDocuments(items);
      } catch {
        if (mounted) {
          const translated = t('consent.documentUnavailable');
          setDocumentError(
            translated === 'consent.documentUnavailable'
              ? 'Documents indisponibles. Vous pourrez continuer hors ligne.'
              : translated,
          );
        }
      } finally {
        if (mounted) setLoadingDocs(false);
      }
    };
    void loadDocuments();
    return () => {
      mounted = false;
    };
  }, [language, t]);

  const documentsByKey = useMemo(() => {
    return new Map(documents.map((document) => [document.document_key, document]));
  }, [documents]);

  const allAccepted = consents.cgu && consents.privacy && consents.data;

  const toggle = (key: ConsentKey) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!allAccepted) return;
    setSubmitting(true);
    const sid = sessionId || `offline-${Date.now()}`;
    if (!sessionId) setSessionId(sid);
    const acceptedDocuments = (['cgu', 'privacy', 'data'] as ConsentKey[])
      .map((key) => documentsByKey.get(CONSENT_TO_DOCUMENT_KEY[key]))
      .filter((document): document is LegalDocument => Boolean(document))
      .map(toAcceptedLegalDocument);

    const online = typeof navigator !== 'undefined' && navigator.onLine;
    if (online) {
      try {
        await fetchWithCorrelation('/api/v1/kyc/consent/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cgu_accepted: true,
            privacy_accepted: true,
            data_processing_accepted: true,
            accepted_documents: acceptedDocuments.length ? acceptedDocuments : undefined,
          }),
        });
      } catch (error) {
        console.error('Failed to submit consent:', error);
        await enqueueOfflineConsent({
          sessionId: sid,
          cguAccepted: true,
          privacyAccepted: true,
          dataProcessingAccepted: true,
          acceptedDocuments,
        });
      }
    } else {
      await enqueueOfflineConsent({
        sessionId: sid,
        cguAccepted: true,
        privacyAccepted: true,
        dataProcessingAccepted: true,
        acceptedDocuments,
      });
    }
    completeStep('consent');
    navigate('/kyc/signature');
  };

  return (
    <ScreenLayoutV2 title={t('consent.title')} showBack>
      <div className="flex flex-col gap-4 py-4">
        {documentError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {documentError}
          </p>
        )}
        {loadingDocs && (
          <p className="text-xs text-muted-foreground">
            {label('consent.loadingDocs', 'Chargement des documents...')}
          </p>
        )}

        <ConsentRow
          keyName="cgu"
          title={documentsByKey.get('cgu')?.title || t('consent.cgu')}
          showDoc
          document={documentsByKey.get('cgu')}
          checked={consents.cgu}
          onToggle={toggle}
          onRead={(document) => document && setActiveDocument(document)}
          t={t}
        />
        <ConsentRow
          keyName="privacy"
          title={documentsByKey.get('privacy')?.title || t('consent.privacy')}
          showDoc
          document={documentsByKey.get('privacy')}
          checked={consents.privacy}
          onToggle={toggle}
          onRead={(document) => document && setActiveDocument(document)}
          t={t}
        />
        <ConsentRow
          keyName="data"
          title={documentsByKey.get('data_processing')?.title || t('consent.data')}
          showDoc
          document={documentsByKey.get('data_processing')}
          checked={consents.data}
          onToggle={toggle}
          onRead={(document) => document && setActiveDocument(document)}
          t={t}
        />

        <div className="pt-4">
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!allAccepted}
          >
            {t('consent.submit')}
          </Button>
        </div>
      </div>

      {activeDocument && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 px-4 pb-4 pt-20">
          <div className="max-h-[82vh] w-full overflow-hidden rounded-2xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{activeDocument.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {label('consent.version', 'Version')} {activeDocument.version}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label={label('consent.close', 'Fermer')}
                onClick={() => setActiveDocument(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[66vh] overflow-y-auto whitespace-pre-wrap px-4 py-4 text-sm leading-6 text-foreground">
              {activeDocument.content}
            </div>
          </div>
        </div>
      )}
    </ScreenLayoutV2>
  );
}
