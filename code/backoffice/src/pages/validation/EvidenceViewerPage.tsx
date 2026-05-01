import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDossier, useAuditLog } from '@/hooks/useQueryHooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { DossierTimeline } from '@/components/shared/DossierTimeline';
import { RequestInfoModal } from '@/components/shared/RequestInfoModal';
import { ArrowLeft, Check, X, MessageSquare, Loader2, Send, UserCheck, Pencil, Save } from 'lucide-react';
import { reviewDossier, assignDossier, autoAssignDossier } from '@/services/dossier-service';
import { apiGet, apiPost } from '@/services/api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TOKEN_KEY = 'veripass_access_token';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function useAuthenticatedImage(sessionId: string | undefined, docId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !docId) return;
    let cancelled = false;
    const token = getToken();
    if (!token) return;

    const fetchUrl = `${API_BASE}/backoffice/dossier/${sessionId}/documents/${docId}/file`;

    fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          // Revoke previous URL to avoid memory leak
          if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
          const objectUrl = URL.createObjectURL(blob);
          prevUrlRef.current = objectUrl;
          setUrl(objectUrl);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      // Don't revoke here — let the next fetch or unmount handle it
    };
  }, [sessionId, docId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return url;
}

function SupportThreadPanel({ sessionId }: { sessionId: string }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiGet(`/backoffice/support/threads?session_id=${sessionId}`);
      setThreads(data);
      if (data.length > 0 && !activeThreadId) {
        setActiveThreadId(data[0].id);
      }
    } catch {}
  }, [sessionId, activeThreadId]);

  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const data = await apiGet(`/backoffice/support/threads/${threadId}/messages`);
      setMessages(data);
    } catch {}
  }, []);

  useEffect(() => { loadThreads() }, [loadThreads]);

  useEffect(() => {
    if (activeThreadId) loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createThread = async () => {
    try {
      const thread = await apiPost('/backoffice/support/threads', { session_id: sessionId });
      setThreads([thread, ...threads]);
      setActiveThreadId(thread.id);
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThreadId) return;
    setSending(true);
    try {
      const msg = await apiPost(`/backoffice/support/threads/${activeThreadId}/messages`, { content: newMessage });
      setMessages([...messages, msg]);
      setNewMessage('');
    } catch {}
    setSending(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Support Client</CardTitle>
        {threads.length === 0 && (
          <Button variant="outline" size="sm" onClick={createThread}>
            <MessageSquare className="h-3 w-3 mr-1" /> Nouveau thread
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun échange avec le client. Créez un thread pour envoyer un message.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`p-2 rounded-lg text-sm ${
                  msg.sender_type === 'JEAN' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {msg.sender_type === 'JEAN' ? 'Vous' : 'Client'} · {new Date(msg.sent_at).toLocaleTimeString('fr-FR')}
                </p>
                <p>{msg.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />

            <div className="flex gap-2 pt-2 border-t">
              <input
                className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                placeholder="Écrire un message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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

export default function EvidenceViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const documents = dossier?.documents || [];
  const currentDoc = documents[activeDocIndex];
  const imageUrl = useAuthenticatedImage(id, currentDoc?.id);

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
        navigate('/validation');
      }
      setShowApprove(false);
      setShowReject(false);
      setActionReason('');
    } catch {}
    setActionLoading(false);
  };

  const handleInfoRequest = async (message: string, _fields: string[]) => {
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

  const startOcrEdit = () => {
    const initial: Record<string, string> = {};
    currentDoc?.ocr_fields?.forEach((f: any) => {
      initial[f.field_name] = f.human_corrected ? f.corrected_value : f.extracted_value;
    });
    setOcrEditedFields(initial);
    setOcrEditMode(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!dossier) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <p className="text-destructive font-medium">Dossier introuvable</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/validation')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  const needsAssign = !dossier.assigned_agent_id;
  const isReviewable = dossier.status === 'PENDING_AGENT_REVIEW' || dossier.status === 'PENDING_KYC' || dossier.status === 'FRAUD_SUSPECT';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/validation')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-lg font-bold">
              {dossier.client_name || dossier.user_phone || 'Dossier'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {dossier.agency_code ? `Agence: ${dossier.agency_code}` : ''} · {dossier.session_id?.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={dossier.status === 'PENDING_AGENT_REVIEW' ? 'warning' : 'default'}>
            {dossier.status}
          </Badge>
        </div>
      </div>

      {assignError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{assignError}</div>
      )}

      {needsAssign && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm font-medium text-yellow-800">Dossier non assigné</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAutoAssign} disabled={assignLoading}>
                {assignLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                Assigner auto
              </Button>
              <Button size="sm" onClick={handleSelfAssign} disabled={assignLoading}>
                {assignLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                Prendre en charge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              {documents.length > 0 && (
                <Tabs value={`${activeDocIndex}`} onValueChange={(v) => setActiveDocIndex(Number(v))}>
                  <TabsList>
                    {documents.map((doc: any, i: number) => (
                      <TabsTrigger key={doc.id} value={`${i}`}>{doc.doc_type}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent>
              <ImageViewer
                src={imageUrl || '/placeholder.jpg'}
                alt={currentDoc?.doc_type || 'Document'}
                className="min-h-[300px]"
              />
            </CardContent>
          </Card>

          {dossier.biometric_result && (
            <Card>
              <CardHeader><CardTitle>Biométrie</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Face Match', score: dossier.biometric_result.face_match_score },
                  { label: 'Liveness', score: dossier.biometric_result.liveness_score },
                  { label: 'Anti-Spoofing', score: dossier.biometric_result.anti_spoofing_score },
                ].map((item: any) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <span className={`text-sm font-mono ${item.score != null && item.score >= 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
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

          <SupportThreadPanel sessionId={id || ''} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Champs extraits (OCR)</CardTitle>
              {currentDoc?.ocr_fields && currentDoc.ocr_fields.length > 0 && (
                <div className="flex gap-2">
                  {ocrEditMode ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setOcrEditMode(false); setOcrEditedFields({}); }}>
                        <X className="h-3 w-3 mr-1" /> Annuler
                      </Button>
                      <Button size="sm" onClick={handleOcrSave} disabled={ocrSaving}>
                        {ocrSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Enregistrer
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={startOcrEdit}>
                      <Pencil className="h-3 w-3 mr-1" /> Modifier
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {currentDoc?.ocr_fields?.map((field: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className={`text-xs font-mono ${
                      field.confidence_score >= 0.9 ? 'text-green-600' :
                      field.confidence_score >= 0.7 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(field.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{field.field_name}</p>
                    {ocrEditMode ? (
                      <input
                        type="text"
                        value={ocrEditedFields[field.field_name] || ''}
                        onChange={(e) => setOcrEditedFields({ ...ocrEditedFields, [field.field_name]: e.target.value })}
                        className="w-full text-sm font-medium border rounded px-2 py-1"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {field.human_corrected ? field.corrected_value : field.extracted_value}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {field.human_corrected && (
                      <span className="text-xs text-blue-600 italic">Corrigé</span>
                    )}
                    {field.corrected_by_agent_id && (
                      <span className="text-xs text-purple-600 italic">Agent</span>
                    )}
                    {!field.human_corrected && !field.corrected_by_agent_id && field.confidence_score < 0.7 && (
                      <span className="text-xs text-orange-500">Faible</span>
                    )}
                  </div>
                </div>
              ))}
              {(!currentDoc?.ocr_fields || currentDoc.ocr_fields.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun champ OCR disponible
                </p>
              )}
            </CardContent>
          </Card>

          {dossier.aml_alerts && dossier.aml_alerts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Alertes AML</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dossier.aml_alerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 rounded-lg border border-red-200 bg-red-50">
                    <div>
                      <p className="text-sm font-medium">{alert.alert_type}</p>
                      <p className="text-xs text-muted-foreground">{alert.status}</p>
                    </div>
                    <span className="text-sm font-mono text-red-600">
                      {(alert.match_score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isReviewable && (
            <Card>
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {dossier.status !== 'FRAUD_SUSPECT' && (
                  <Button className="w-full" onClick={() => setShowApprove(true)}>
                    <Check className="h-4 w-4 mr-2" /> Approuver
                  </Button>
                )}
                <Button variant="destructive" className="w-full" onClick={() => setShowReject(true)}>
                  <X className="h-4 w-4 mr-2" /> Rejeter
                </Button>
                {dossier.status !== 'FRAUD_SUSPECT' && (
                  <Button variant="outline" className="w-full" onClick={() => setShowRequestInfo(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Demander des informations
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
            <DialogDescription>Justification obligatoire (traçabilité COBAC).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Ex: Identité vérifiée, documents conformes..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowApprove(false); setActionReason('') }}>Annuler</Button>
            <Button onClick={() => handleReview('APPROVED')} disabled={actionLoading || !actionReason.trim()}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmer l'approbation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dossier.status === 'FRAUD_SUSPECT' ? 'Classer sans suite (investigation)' : 'Rejeter le dossier'}</DialogTitle>
            <DialogDescription>Motif obligatoire pour le rejet.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Ex: Document flou, identité non vérifiable..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReject(false); setActionReason('') }}>Annuler</Button>
            <Button variant="destructive" onClick={() => handleReview('REJECTED')} disabled={actionLoading || !actionReason.trim()}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequestInfoModal
        open={showRequestInfo}
        onOpenChange={setShowRequestInfo}
        onSubmit={handleInfoRequest}
        fieldNames={currentDoc?.ocr_fields?.filter((f: any) => f.confidence_score < 0.7)?.map((f: any) => f.field_name) || []}
      />
    </div>
  );
}
