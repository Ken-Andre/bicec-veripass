/**
 * EvidenceViewerPage — Inspection dossier complète pour Jean
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — Split-screen: documents gauche / OCR + actions droite
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDossier, useAuditLog } from '@/hooks/useQueryHooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ImageViewer } from '@/components/shared/ImageViewer';
import { StatusChip } from '@/components/shared/StatusChip';
import { ConfidenceBar } from '@/components/shared/ConfidenceBar';
import { FlagBadge } from '@/components/shared/FlagBadge';
import { DossierTimeline } from '@/components/shared/DossierTimeline';
import { RequestInfoModal } from '@/components/shared/RequestInfoModal';
import { ArrowLeft, Check, X, MessageSquare, Loader2 } from 'lucide-react';
import type { DossierFlag } from '@/types';

// Mock dossier data until API is ready
const mockDossier = {
  id: 'demo-session-id',
  status: 'PENDING_REVIEW',
  accessLevel: 'RESTRICTED',
  overallConfidence: 0.82,
  clientIdentity: {
    lastName: 'NGUEMO',
    firstName: 'Marie Claire',
    dateOfBirth: '15/03/1992',
    placeOfBirth: 'Douala',
    phone: '+237 6XX XXX XXX',
    email: 'marie@example.cm',
  },
  flags: ['LOW_OCR'],
  documents: [
    { id: 'doc1', docType: 'CNI_RECTO', url: '/placeholder-cni.jpg', ocrFields: [
      { fieldName: 'Nom', extractedValue: 'NGUEMO', confidence: 0.96, correctedValue: '', needsReview: false },
      { fieldName: 'Prénom', extractedValue: 'Marie Claire', confidence: 0.92, correctedValue: '', needsReview: false },
      { fieldName: 'Date Naissance', extractedValue: '15/03/1992', confidence: 0.72, correctedValue: '', needsReview: true },
      { fieldName: 'Lieu Naissance', extractedValue: 'Douala', confidence: 0.88, correctedValue: '', needsReview: false },
    ]},
  ],
  biometrics: { faceMatchScore: 0.91, livenessScore: 0.95, antiSpoofingScore: 0.98 },
};

export default function EvidenceViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: dossier, isLoading } = useDossier(id || '');
  const { data: auditEntries } = useAuditLog(id);
  const [activeDoc, setActiveDoc] = useState(0);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const data = dossier || mockDossier;
  const currentDoc = data.documents?.[activeDoc] || { ocrFields: [] };

  const handleInfoRequest = async (message: string, fields: string[]) => {
    // TODO: Call POST /api/v1/backoffice/dossiers/{id}/request-info
    console.log('Request info:', message, fields);
    setShowRequestInfo(false);
  };

  const handleApprove = async () => {
    // TODO: Call POST /api/v1/backoffice/dossiers/{id}/approve
    console.log('Approved');
    navigate('/validation');
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    // TODO: Call POST /api/v1/backoffice/dossiers/{id}/reject
    console.log('Rejected:', reason);
    setShowReject(false);
    navigate('/validation');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/validation')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-lg font-bold">
              {data.clientIdentity?.firstName || '—'} {data.clientIdentity?.lastName || '—'}
            </h1>
            <p className="text-sm text-muted-foreground">
              NIU: {data.clientIdentity?.niu || '—'} • Dossier: {data.id?.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={data.status} />
          {data.flags?.map((flag: DossierFlag) => <FlagBadge key={flag} flag={flag} />)}
        </div>
      </div>

      {/* Split Screen */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left - Documents */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={`${activeDoc}`} onValueChange={(v: string) => setActiveDoc(Number(v))}>
                <TabsList>
                  {data.documents?.map((doc: { docType: string }, i: number) => (
                    <TabsTrigger key={i} value={`${i}`}>{doc.docType}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <ImageViewer
                src={currentDoc.url || '/placeholder.jpg'}
                alt={currentDoc.docType || 'Document'}
                className="min-h-[300px]"
              />
            </CardContent>
          </Card>

          {/* Biometrics */}
          {data.biometrics && (
            <Card>
              <CardHeader><CardTitle>Biométrie</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Face Match</span>
                  <ConfidenceBar score={data.biometrics.faceMatchScore} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Liveness</span>
                  <ConfidenceBar score={data.biometrics.livenessScore} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Anti-Spoofing</span>
                  <ConfidenceBar score={data.biometrics.antiSpoofingScore} size="sm" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Timeline */}
          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent>
              <DossierTimeline entries={auditEntries || []} />
            </CardContent>
          </Card>
        </div>

        {/* Right - OCR Fields + Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Champs OCR extraits</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {currentDoc.ocrFields?.map((field: { fieldName: string; extractedValue: string; confidence: number; correctedValue?: string; needsReview?: boolean }, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
                  <ConfidenceBar score={field.confidence} size="sm" className="w-[60px] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{field.fieldName}</p>
                    {editingField === `${activeDoc}-${i}` ? (
                      <Input
                        size={1}
                        defaultValue={field.extractedValue}
                        onBlur={() => {
                          // TODO: Save correction
                          setEditingField(null);
                        }}
                        className="h-6 text-sm"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">{field.extractedValue}</p>
                    )}
                  </div>
                  {field.needsReview && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingField(`${activeDoc}-${i}`)}>✏️</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="flex gap-3">
              <Button className="flex-1" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-2" /> Approuver
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setShowReject(true)}>
                <X className="h-4 w-4 mr-2" /> Rejeter
              </Button>
              <Button variant="outline" onClick={() => setShowRequestInfo(true)}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request Info Modal */}
      <RequestInfoModal
        open={showRequestInfo}
        onOpenChange={setShowRequestInfo}
        onSubmit={handleInfoRequest}
        fieldNames={currentDoc.ocrFields?.filter((f: { needsReview: boolean }) => f.needsReview)?.map((f: { fieldName: string }) => f.fieldName)}
      />

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le dossier</DialogTitle>
            <DialogDescription>Motif obligatoire pour le rejet.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Document flou, impossibilité de vérifier l'identité..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason.trim()}>Confirmer le rejet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}