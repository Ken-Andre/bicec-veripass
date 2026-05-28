import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Save,
  Send,
  ShieldAlert,
  Tags,
  UserCheck,
  X,
} from 'lucide-react';

import { FaceComparisonCard } from '@/components/shared/FaceComparisonCard';
import { DossierTimeline } from '@/components/shared/DossierTimeline';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { RequestInfoModal } from '@/components/shared/RequestInfoModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog, useDossier } from '@/hooks/useQueryHooks';
import { apiGet, apiGetBlob, apiPost } from '@/services/api-client';
import { assignDossier, autoAssignDossier, reviewDossier } from '@/services/dossier-service';

const IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const EXPECTED_OCR_FIELDS_BY_DOC: Record<string, string[]> = {
  CNI_RECTO: ['numero_cni', 'nom', 'prenom', 'date_naissance', 'lieu_naissance', 'sexe', 'taille', 'profession'],
  CNI_VERSO: ['numero_cni', 'adresse', 'date_delivrance', 'date_expiration', 'autorite_nom'],
};

const CNI_FINAL_FIELDS: Array<{ key: string; label: string; aliases: string[]; sources: string[] }> = [
  { key: 'numero_cni', label: 'Numero CNI', aliases: ['numero_cni', 'cni_number', 'id_number'], sources: ['CNI_RECTO', 'CNI_VERSO'] },
  { key: 'nom', label: 'Nom', aliases: ['nom', 'surname', 'last_name'], sources: ['CNI_RECTO'] },
  { key: 'prenom', label: 'Prenom', aliases: ['prenom', 'first_name', 'given_name'], sources: ['CNI_RECTO'] },
  { key: 'date_naissance', label: 'Date naissance', aliases: ['date_naissance', 'date_of_birth'], sources: ['CNI_RECTO'] },
  { key: 'lieu_naissance', label: 'Lieu naissance', aliases: ['lieu_naissance', 'place_of_birth'], sources: ['CNI_RECTO'] },
  { key: 'sexe', label: 'Sexe', aliases: ['sexe', 'gender', 'sex'], sources: ['CNI_RECTO'] },
  { key: 'taille', label: 'Taille', aliases: ['taille', 'height'], sources: ['CNI_RECTO'] },
  { key: 'profession', label: 'Profession', aliases: ['profession', 'occupation'], sources: ['CNI_RECTO'] },
  { key: 'adresse', label: 'Adresse', aliases: ['adresse', 'address'], sources: ['CNI_VERSO'] },
  { key: 'date_delivrance', label: 'Date delivrance', aliases: ['date_delivrance', 'issue_date'], sources: ['CNI_VERSO'] },
  { key: 'date_expiration', label: 'Date expiration', aliases: ['date_expiration', 'expiry_date', 'expiration_date'], sources: ['CNI_VERSO'] },
  { key: 'autorite_nom', label: 'Autorite', aliases: ['autorite_nom', 'issuing_authority'], sources: ['CNI_VERSO'] },
];

interface DocumentPayload {
  id: string;
  doc_type: string;
  ocr_fields?: Array<{
    field_name: string;
    extracted_value: string;
    corrected_value?: string;
    human_corrected?: boolean;
    corrected_by_agent_id?: string;
    confidence_score: number;
  }>;
}

interface CniFinalRow {
  key: string;
  label: string;
  value: string;
  confidence: number | null;
  sourceDocumentId: string | null;
  sourceDocType: string | null;
  sourceFieldName: string | null;
  corrected: boolean;
}

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function useAuthenticatedDocument(sessionId: string | undefined, docId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !docId) {
      setUrl(null);
      setContentType(null);
      setFilename(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGetBlob(`/backoffice/dossier/${sessionId}/documents/${docId}/file`)
      .then(({ blob, contentType: fetchedType, filename: fetchedName }) => {
        if (cancelled) return;
        if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
        const nextUrl = URL.createObjectURL(blob);
        previousUrlRef.current = nextUrl;
        setUrl(nextUrl);
        setContentType(fetchedType || blob.type || null);
        setFilename(fetchedName || null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setUrl(null);
        setContentType(null);
        setFilename(null);
        setError(err?.detail || 'Impossible de charger ce document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, docId]);

  useEffect(() => {
    return () => {
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    };
  }, []);

  return { url, contentType, filename, loading, error };
}

interface SupportThreadPanelProps {
  sessionId: string;
  onOpenDocumentFromChat: (documentId: string) => void;
}

function SupportThreadPanel({ sessionId, onOpenDocumentFromChat }: SupportThreadPanelProps) {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiGet(`/backoffice/support/threads?session_id=${sessionId}`);
      setThreads(data);
      if (data.length > 0 && !activeThreadId) {
        setActiveThreadId(data[0].id);
      }
    } catch {}
  }, [activeThreadId, sessionId]);

  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const data = await apiGet(`/backoffice/support/threads/${threadId}/messages`);
      setMessages(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (activeThreadId) loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createThread = async () => {
    try {
      const thread = await apiPost('/backoffice/support/threads', { session_id: sessionId });
      setThreads((previous) => [thread, ...previous]);
      setActiveThreadId(thread.id);
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThreadId) return;
    setSending(true);
    try {
      const message = await apiPost(`/backoffice/support/threads/${activeThreadId}/messages`, { content: newMessage });
      setMessages((previous) => [...previous, message]);
      setNewMessage('');
    } catch {}
    setSending(false);
  };

  const openAttachment = async (messageId: string, download: boolean) => {
    setAttachmentLoadingId(messageId);
    try {
      const { blob, filename } = await apiGetBlob(`/backoffice/support/messages/${messageId}/attachment`);
      const objectUrl = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename || 'piece-jointe';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {}
    setAttachmentLoadingId(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Support Client</CardTitle>
        {threads.length === 0 && (
          <Button variant="outline" size="sm" onClick={createThread}>
            <MessageSquare className="mr-1 h-3 w-3" /> Nouveau thread
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Aucun echange avec le client. Creez un thread pour envoyer un message.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message: any) => (
              <div
                key={message.id}
                className={`rounded-lg p-2 text-sm ${message.sender_type === 'JEAN' ? 'ml-4 bg-primary/10' : 'mr-4 bg-muted'}`}
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  {message.sender_type === 'JEAN' ? 'Vous' : 'Client'} - {new Date(message.sent_at).toLocaleTimeString('fr-FR')}
                </p>
                <p>{message.content}</p>
                {(message.attachment_path || message.attachment_sha256) && (
                  <div className="mt-2 space-y-2 rounded-md border bg-background/70 px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-1 font-medium">
                      <FileText className="h-3 w-3" />
                      Fichier joint client
                    </div>
                    {message.attachment_filename && (
                      <p className="break-all text-muted-foreground">{message.attachment_filename}</p>
                    )}
                    {message.attachment_sha256 && (
                      <p className="break-all text-muted-foreground">SHA-256: {message.attachment_sha256}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={attachmentLoadingId === message.id}
                        onClick={() => openAttachment(message.id, false)}
                      >
                        {attachmentLoadingId === message.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="mr-1 h-3 w-3" />}
                        Ouvrir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={attachmentLoadingId === message.id}
                        onClick={() => openAttachment(message.id, true)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Telecharger
                      </Button>
                      {message.attachment_document_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => onOpenDocumentFromChat(message.attachment_document_id)}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Ouvrir dans dossier
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />

            <div className="flex gap-2 border-t pt-2">
              <input
                className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                placeholder="Ecrire un message..."
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button size="sm" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function scoreLabel(score: number | null): string {
  if (score == null) return 'N/A';
  return `${(score * 100).toFixed(0)}%`;
}

export default function EvidenceViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: dossier, isLoading } = useDossier(id || '');
  const { data: auditEntries } = useAuditLog(id);

  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [ocrEditMode, setOcrEditMode] = useState(false);
  const [ocrEditedFields, setOcrEditedFields] = useState<Record<string, string>>({});
  const [ocrSaving, setOcrSaving] = useState(false);
  const [showAllOcrFields, setShowAllOcrFields] = useState(false);
  const [cniEditMode, setCniEditMode] = useState(false);
  const [cniEditedFields, setCniEditedFields] = useState<Record<string, string>>({});
  const [cniSaving, setCniSaving] = useState(false);

  const [classifyDocType, setClassifyDocType] = useState('CNI_RECTO');
  const [classifyCategories, setClassifyCategories] = useState('CNI_RECTO');
  const [classifyReason, setClassifyReason] = useState('');
  const [classifySaving, setClassifySaving] = useState(false);

  const documents: DocumentPayload[] = dossier?.documents || [];
  const currentDoc = documents[activeDocIndex];
  const documentView = useAuthenticatedDocument(id, currentDoc?.id);

  useEffect(() => {
    if (!currentDoc?.doc_type) return;
    setClassifyDocType(currentDoc.doc_type);
    setClassifyCategories(currentDoc.doc_type);
    setShowAllOcrFields(false);
  }, [currentDoc?.doc_type, currentDoc?.id]);

  const displayedCurrentDocFields = useMemo(() => {
    const rawFields = currentDoc?.ocr_fields || [];
    if (showAllOcrFields || !currentDoc?.doc_type) return rawFields;
    const expected = EXPECTED_OCR_FIELDS_BY_DOC[currentDoc.doc_type];
    if (!expected) return rawFields;
    const expectedSet = new Set(expected);
    return rawFields.filter((field) => expectedSet.has(normalizeFieldName(field.field_name)));
  }, [currentDoc?.doc_type, currentDoc?.ocr_fields, showAllOcrFields]);

  const cniFinalRows = useMemo<CniFinalRow[]>(() => {
    const cniDocs = documents.filter((doc) => doc.doc_type === 'CNI_RECTO' || doc.doc_type === 'CNI_VERSO');
    if (cniDocs.length === 0) return [];

    return CNI_FINAL_FIELDS.map((definition) => {
      const aliases = new Set(definition.aliases.map(normalizeFieldName));
      const candidates = cniDocs
        .filter((doc) => definition.sources.includes(doc.doc_type))
        .flatMap((doc) =>
          (doc.ocr_fields || [])
            .filter((field) => aliases.has(normalizeFieldName(field.field_name)))
            .map((field) => ({
              doc,
              field,
              value: field.human_corrected && field.corrected_value ? field.corrected_value : field.extracted_value || '',
            })),
        )
        .sort((left, right) => {
          const leftHasValue = left.value.trim() ? 1 : 0;
          const rightHasValue = right.value.trim() ? 1 : 0;
          if (leftHasValue !== rightHasValue) return rightHasValue - leftHasValue;
          if ((left.field.human_corrected ? 1 : 0) !== (right.field.human_corrected ? 1 : 0)) {
            return (right.field.human_corrected ? 1 : 0) - (left.field.human_corrected ? 1 : 0);
          }
          return (right.field.confidence_score || 0) - (left.field.confidence_score || 0);
        });

      const best = candidates[0];
      if (!best) {
        return {
          key: definition.key,
          label: definition.label,
          value: '',
          confidence: null,
          sourceDocumentId: null,
          sourceDocType: null,
          sourceFieldName: null,
          corrected: false,
        };
      }

      return {
        key: definition.key,
        label: definition.label,
        value: best.value,
        confidence: best.field.confidence_score ?? null,
        sourceDocumentId: best.doc.id,
        sourceDocType: best.doc.doc_type,
        sourceFieldName: best.field.field_name,
        corrected: Boolean(best.field.human_corrected),
      };
    });
  }, [documents]);

  const handleOpenCurrentDoc = useCallback(() => {
    if (!documentView.url) return;
    window.open(documentView.url, '_blank', 'noopener,noreferrer');
  }, [documentView.url]);

  const handleDownloadCurrentDoc = useCallback(() => {
    if (!documentView.url) return;
    const link = document.createElement('a');
    link.href = documentView.url;
    link.download = documentView.filename || `${currentDoc?.doc_type || 'document'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentDoc?.doc_type, documentView.filename, documentView.url]);

  const handleOpenDocumentFromChat = useCallback((documentId: string) => {
    const nextIndex = documents.findIndex((doc) => doc.id === documentId);
    if (nextIndex >= 0) {
      setActiveDocIndex(nextIndex);
      setClassifyReason('Document complementaire charge depuis le support client.');
    }
  }, [documents]);

  const handleSelfAssign = async () => {
    if (!id) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      const storedUser = localStorage.getItem('veripass_user');
      const agentId = storedUser ? JSON.parse(storedUser).id : null;
      if (!agentId) throw new Error('ID agent introuvable');
      await assignDossier(id, agentId);
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
    } catch (err: any) {
      setAssignError(err?.detail || "Impossible d'assigner le dossier");
    }
    setAssignLoading(false);
  };

  const handleAutoAssign = async () => {
    if (!id) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      await autoAssignDossier(id);
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
    } catch (err: any) {
      setAssignError(err?.detail || "Impossible d'assigner automatiquement");
    }
    setAssignLoading(false);
  };

  const handleReview = async (decision: string) => {
    if (!id || !actionReason.trim()) return;
    setActionLoading(true);
    try {
      await reviewDossier(id, decision, actionReason.trim());
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      if (decision === 'APPROVED' || decision === 'REJECTED') {
        navigate(user?.role === 'THOMAS' ? '/compliance' : '/validation');
      }
      if (decision === 'FRAUD_SUSPECT') {
        navigate('/compliance');
      }
      setShowApprove(false);
      setShowReject(false);
      setActionReason('');
    } catch {}
    setActionLoading(false);
  };

  const handleInfoRequest = async (message: string) => {
    if (!id) return;
    try {
      await reviewDossier(id, 'INFO_REQUESTED', message);
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    } catch {}
    setShowRequestInfo(false);
  };

  const handleOcrSave = async () => {
    if (!id || !currentDoc) return;
    setOcrSaving(true);
    try {
      for (const [fieldName, correctedValue] of Object.entries(ocrEditedFields)) {
        await apiPost(`/backoffice/dossier/${id}/ocr-correct`, {
          document_id: currentDoc.id,
          field_name: fieldName,
          corrected_value: correctedValue,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
      setOcrEditMode(false);
      setOcrEditedFields({});
    } catch {}
    setOcrSaving(false);
  };

  const handleCniSave = async () => {
    if (!id) return;
    setCniSaving(true);
    try {
      for (const row of cniFinalRows) {
        const nextValue = cniEditedFields[row.key];
        if (nextValue == null) continue;
        if (!row.sourceDocumentId || !row.sourceFieldName) continue;
        if (nextValue === row.value) continue;
        await apiPost(`/backoffice/dossier/${id}/ocr-correct`, {
          document_id: row.sourceDocumentId,
          field_name: row.sourceFieldName,
          corrected_value: nextValue,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
      setCniEditMode(false);
      setCniEditedFields({});
    } catch {}
    setCniSaving(false);
  };

  const handleClassifyDocument = async () => {
    if (!id || !currentDoc || !classifyReason.trim()) return;
    const categories = classifyCategories
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    if (categories.length === 0) return;

    setClassifySaving(true);
    try {
      await apiPost(`/backoffice/dossier/${id}/documents/${currentDoc.id}/classify`, {
        categories,
        primary_doc_type: classifyDocType,
        reason: classifyReason.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['dossier', id] });
      queryClient.invalidateQueries({ queryKey: ['audit', id] });
      setClassifyReason('');
    } catch {}
    setClassifySaving(false);
  };

  const startOcrEdit = () => {
    const initial: Record<string, string> = {};
    displayedCurrentDocFields.forEach((field) => {
      initial[field.field_name] = field.human_corrected && field.corrected_value ? field.corrected_value : field.extracted_value;
    });
    setOcrEditedFields(initial);
    setOcrEditMode(true);
  };

  const startCniEdit = () => {
    const initial: Record<string, string> = {};
    cniFinalRows.forEach((row) => {
      initial[row.key] = row.value;
    });
    setCniEditedFields(initial);
    setCniEditMode(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!dossier) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <p className="font-medium text-destructive">Dossier introuvable</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/validation')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isReviewable =
    dossier.status === 'PENDING_AGENT_REVIEW' ||
    dossier.status === 'PENDING_KYC' ||
    dossier.status === 'FRAUD_SUSPECT';
  const isJean = user?.role === 'JEAN';
  const isThomas = user?.role === 'THOMAS';
  const backTarget = isThomas ? '/compliance' : '/validation';
  const canJeanReview = isJean && isReviewable;
  const canThomasInvestigate = isThomas && dossier.status !== 'REJECTED';
  const canThomasMarkFraud = canThomasInvestigate && isReviewable && dossier.status !== 'FRAUD_SUSPECT';
  const canEditKycEvidence = isJean;
  const needsAssign = canJeanReview && !dossier.assigned_agent_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(backTarget)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Button>
          <div>
            <h1 className="text-lg font-bold">{dossier.client_name || dossier.user_phone || 'Dossier'}</h1>
            <p className="text-sm text-muted-foreground">
              {dossier.agency_code ? `Agence: ${dossier.agency_code}` : ''} - {dossier.session_id?.slice(0, 8)}...
            </p>
          </div>
        </div>
        <Badge variant={dossier.status === 'PENDING_AGENT_REVIEW' ? 'warning' : 'default'}>
          {dossier.status}
        </Badge>
      </div>

      {assignError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{assignError}</div>}

      {needsAssign && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm font-medium text-yellow-800">Dossier non assigne</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAutoAssign} disabled={assignLoading}>
                {assignLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                Assigner auto
              </Button>
              <Button size="sm" onClick={handleSelfAssign} disabled={assignLoading}>
                {assignLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                Prendre en charge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="overflow-hidden pb-3">
              {documents.length > 0 && (
                <div data-testid="evidence-document-tabs" className="max-w-full overflow-hidden">
                  <Tabs className="max-w-full" value={`${activeDocIndex}`} onValueChange={(value) => setActiveDocIndex(Number(value))}>
                    <TabsList className="flex h-auto max-w-full flex-wrap justify-start gap-1 overflow-visible">
                      {documents.map((doc, index) => (
                        <TabsTrigger key={doc.id} value={`${index}`} className="shrink-0 px-2 text-xs sm:px-3 sm:text-sm">{doc.doc_type}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {documentView.loading && (
                <div className="flex min-h-[300px] items-center justify-center rounded-lg border">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!documentView.loading && documentView.error && (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border px-4 text-center text-sm text-muted-foreground">
                  <p>{documentView.error}</p>
                </div>
              )}
              {!documentView.loading && !documentView.error && (
                <>
                  {(documentView.contentType || '').startsWith('image/') && (
                    <ImageViewer
                      src={documentView.url || IMAGE_PLACEHOLDER}
                      alt={currentDoc?.doc_type || 'Document'}
                      className="min-h-[300px]"
                      onOpenOriginal={handleOpenCurrentDoc}
                      onDownload={handleDownloadCurrentDoc}
                    />
                  )}
                  {documentView.contentType === 'application/pdf' && documentView.url && (
                    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border px-4 text-center text-sm text-muted-foreground">
                      <FileText className="h-8 w-8 text-slate-500" />
                      <p>Apercu PDF desactive dans l&apos;application pour compatibilite CSP.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleOpenCurrentDoc}>
                          <Eye className="mr-1 h-3 w-3" /> Ouvrir le PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadCurrentDoc}>
                          <Download className="mr-1 h-3 w-3" /> Telecharger
                        </Button>
                      </div>
                    </div>
                  )}
                  {!documentView.contentType && (
                    <ImageViewer
                      src={documentView.url || IMAGE_PLACEHOLDER}
                      alt={currentDoc?.doc_type || 'Document'}
                      className="min-h-[300px]"
                      onOpenOriginal={handleOpenCurrentDoc}
                      onDownload={handleDownloadCurrentDoc}
                    />
                  )}
                  {documentView.contentType && !(documentView.contentType.startsWith('image/') || documentView.contentType === 'application/pdf') && (
                    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border px-4 text-center text-sm text-muted-foreground">
                      <p>Apercu indisponible pour ce type de fichier.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleOpenCurrentDoc}>
                          <Eye className="mr-1 h-3 w-3" /> Ouvrir
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadCurrentDoc}>
                          <Download className="mr-1 h-3 w-3" /> Telecharger
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {currentDoc && canEditKycEvidence && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="h-4 w-4" /> Classification du document</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Type principal</p>
                    <Select value={classifyDocType} onValueChange={setClassifyDocType}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        {['CNI_RECTO', 'CNI_VERSO', 'BILL_ENEO', 'BILL_CAMWATER', 'NIU', 'SELFIE', 'IDENTITY_PROOF', 'ADDRESS_PROOF', 'OTHER'].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Categories</p>
                    <input
                      value={classifyCategories}
                      onChange={(event) => setClassifyCategories(event.target.value)}
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      placeholder="CNI_RECTO, ADDRESS_PROOF"
                    />
                  </div>
                </div>
                <Textarea
                  value={classifyReason}
                  onChange={(event) => setClassifyReason(event.target.value)}
                  placeholder="Pourquoi ce document couvre ces categories ?"
                  className="min-h-[72px]"
                />
                <Button size="sm" onClick={handleClassifyDocument} disabled={classifySaving || !classifyReason.trim()}>
                  {classifySaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                  Assigner le document
                </Button>
              </CardContent>
            </Card>
          )}

          {(() => {
            const selfieDoc = documents.find((doc) => doc.doc_type === 'SELFIE');
            const cniRectoDoc = documents.find((doc) => doc.doc_type === 'CNI_RECTO');
            if (!selfieDoc || !cniRectoDoc) return null;
            return (
              <FaceComparisonCard
                sessionId={id || ''}
                selfieDocId={selfieDoc.id}
                cniRectoDocId={cniRectoDoc.id}
                faceMatchScore={dossier.biometric_result?.face_match_score}
                faceMatchStatus={dossier.biometric_result?.face_match_status}
                faceMatchReason={dossier.biometric_result?.face_match_reason}
                faceMatchDistance={dossier.biometric_result?.face_match_distance}
                faceMatchThreshold={dossier.biometric_result?.face_match_threshold}
                faceMatchDetector={dossier.biometric_result?.face_match_detector}
                modelVersionFace={dossier.biometric_result?.model_version_face}
              />
            );
          })()}

          <Card>
            <CardHeader><CardTitle>Adresse et NIU</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: 'Ville', value: dossier.address_city },
                { label: 'Commune', value: dossier.address_commune },
                { label: 'Quartier', value: dossier.address_quartier },
                { label: 'Lieu-dit', value: dossier.address_lieu_dit },
                { label: 'Region', value: dossier.address_details },
                { label: 'GPS', value: dossier.gps_latitude != null && dossier.gps_longitude != null ? `${dossier.gps_latitude}, ${dossier.gps_longitude}` : null },
                { label: 'Type NIU', value: dossier.niu_type },
                { label: 'Numero NIU', value: dossier.niu_number },
                { label: 'NIU declaratif', value: dossier.niu_declarative ? 'Oui' : 'Non' },
              ].map((item: any) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-right font-medium">{item.value || 'N/A'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {dossier.biometric_result && (
            <Card>
              <CardHeader><CardTitle>Biometrie</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Face Match', score: dossier.biometric_result.face_match_score },
                  { label: 'Liveness', score: dossier.biometric_result.liveness_score },
                  { label: 'Anti-Spoofing', score: dossier.biometric_result.anti_spoofing_score },
                ].map((item: any) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <span className={`font-mono text-sm ${item.score != null && item.score >= 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {item.score != null ? `${(item.score * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent>
              <DossierTimeline entries={(auditEntries || []) as any} />
            </CardContent>
          </Card>

          <SupportThreadPanel sessionId={id || ''} onOpenDocumentFromChat={handleOpenDocumentFromChat} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Champs extraits (OCR)</CardTitle>
                  {(currentDoc?.ocr_fields || []).length > 0 && (
                <div className="flex gap-2">
                  {(currentDoc?.doc_type === 'CNI_RECTO' || currentDoc?.doc_type === 'CNI_VERSO') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAllOcrFields((previous) => !previous)}
                    >
                      {showAllOcrFields ? 'Vue ciblee' : 'Voir tout'}
                    </Button>
                  )}
                  {canEditKycEvidence && ocrEditMode ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setOcrEditMode(false); setOcrEditedFields({}); }}>
                        <X className="mr-1 h-3 w-3" /> Annuler
                      </Button>
                      <Button size="sm" onClick={handleOcrSave} disabled={ocrSaving}>
                        {ocrSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                        Enregistrer
                      </Button>
                    </>
                  ) : canEditKycEvidence ? (
                    <Button size="sm" variant="outline" onClick={startOcrEdit}>
                      <Pencil className="mr-1 h-3 w-3" /> Modifier
                    </Button>
                  ) : null}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {displayedCurrentDocFields.map((field, index) => (
                <div key={`${field.field_name}-${index}`} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="w-12 flex-shrink-0 text-center">
                    <span className={`text-xs font-mono ${
                      field.confidence_score >= 0.9 ? 'text-green-600' :
                      field.confidence_score >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {scoreLabel(field.confidence_score)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{field.field_name}</p>
                    {ocrEditMode ? (
                      <input
                        type="text"
                        value={ocrEditedFields[field.field_name] || ''}
                        onChange={(event) => setOcrEditedFields({ ...ocrEditedFields, [field.field_name]: event.target.value })}
                        className="w-full rounded border px-2 py-1 text-sm font-medium"
                      />
                    ) : (
                      <p className="truncate text-sm font-medium">
                        {field.human_corrected && field.corrected_value ? field.corrected_value : field.extracted_value}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {field.human_corrected && <span className="text-xs italic text-blue-600">Corrige</span>}
                    {!field.human_corrected && field.confidence_score < 0.7 && <span className="text-xs text-orange-500">Faible</span>}
                  </div>
                </div>
              ))}
              {displayedCurrentDocFields.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucun champ OCR disponible</p>
              )}
            </CardContent>
          </Card>

          {cniFinalRows.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>OCR final CNI (Recto + Verso)</CardTitle>
                {canEditKycEvidence && cniEditMode ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setCniEditMode(false); setCniEditedFields({}); }}>
                      <X className="mr-1 h-3 w-3" /> Annuler
                    </Button>
                    <Button size="sm" onClick={handleCniSave} disabled={cniSaving}>
                      {cniSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      Enregistrer
                    </Button>
                  </div>
                ) : canEditKycEvidence ? (
                  <Button size="sm" variant="outline" onClick={startCniEdit}>
                    <Pencil className="mr-1 h-3 w-3" /> Modifier
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {cniFinalRows.map((row) => (
                  <div key={row.key} className="space-y-1 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.sourceDocType || 'SOURCE_MANQUANTE'} - {scoreLabel(row.confidence)}</p>
                    </div>
                    {cniEditMode ? (
                      <input
                        type="text"
                        value={cniEditedFields[row.key] || ''}
                        onChange={(event) => setCniEditedFields({ ...cniEditedFields, [row.key]: event.target.value })}
                        className="w-full rounded border px-2 py-1 text-sm font-medium"
                        disabled={!row.sourceDocumentId}
                      />
                    ) : (
                      <p className="text-sm font-medium">{row.value || '-'}</p>
                    )}
                    {row.corrected && <p className="text-xs italic text-blue-600">Corrige manuellement</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isThomas && (dossier.aml_alerts || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Alertes AML liees</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(dossier.aml_alerts || []).map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
                    <div>
                      <p className="text-sm font-medium">{alert.alert_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Score {scoreLabel(alert.match_score)} - {alert.status}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/compliance/alert/${alert.id}`)}>
                      Traiter
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(canJeanReview || canThomasInvestigate) && (
            <Card>
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {canJeanReview && dossier.status !== 'FRAUD_SUSPECT' && (
                  <Button className="w-full" onClick={() => setShowApprove(true)}>
                    <Check className="mr-2 h-4 w-4" /> Approuver
                  </Button>
                )}
                {canJeanReview && (
                <Button variant="destructive" className="w-full" onClick={() => setShowReject(true)}>
                  <X className="mr-2 h-4 w-4" /> Rejeter
                </Button>
                )}
                {canThomasMarkFraud && (
                  <Button variant="destructive" className="w-full" onClick={() => setShowReject(true)}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Marquer fraude
                  </Button>
                )}
                {(canJeanReview || canThomasInvestigate) && dossier.status !== 'FRAUD_SUSPECT' && (
                  <Button variant="outline" className="w-full" onClick={() => setShowRequestInfo(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Demander des informations
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver le dossier</DialogTitle>
            <DialogDescription>Justification obligatoire (traçabilite COBAC).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Ex: Identite verifiee, documents conformes..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowApprove(false); setActionReason(''); }}>Annuler</Button>
            <Button onClick={() => handleReview('APPROVED')} disabled={actionLoading || !actionReason.trim()}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer l'approbation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isThomas && dossier.status !== 'FRAUD_SUSPECT'
                ? 'Marquer le dossier comme fraude suspectee'
                : dossier.status === 'FRAUD_SUSPECT' ? 'Classer sans suite (investigation)' : 'Rejeter le dossier'}
            </DialogTitle>
            <DialogDescription>Justification obligatoire pour tracer la decision.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Ex: Document flou, identite non verifiable..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReject(false); setActionReason(''); }}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => handleReview(canThomasMarkFraud ? 'FRAUD_SUSPECT' : 'REJECTED')}
              disabled={actionLoading || !actionReason.trim()}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {canThomasMarkFraud ? 'Confirmer la fraude suspectee' : 'Confirmer le rejet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequestInfoModal
        open={showRequestInfo}
        onOpenChange={setShowRequestInfo}
        onSubmit={(message, _fields) => handleInfoRequest(message)}
        fieldNames={(displayedCurrentDocFields || [])
          .filter((field: any) => field.confidence_score < 0.7)
          .map((field: any) => field.field_name)}
      />
    </div>
  );
}
