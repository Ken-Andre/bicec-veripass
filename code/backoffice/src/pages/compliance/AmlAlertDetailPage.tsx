import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, ArrowUp } from 'lucide-react';
import { apiGet, apiPost } from '@/services/api-client';

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

export default function AmlAlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [justification, setJustification] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGet(`/aml/alerts/${id}`)
      .then(setAlert)
      .catch(() => setAlert(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: 'clear' | 'confirm' | 'escalate') => {
    if (!id || !justification.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (action === 'clear') {
        await apiPost(`/aml/alerts/${id}/clear`, { justification });
      } else if (action === 'confirm') {
        await apiPost(`/aml/alerts/${id}/confirm`, { justification });
      } else {
        await apiPost(`/aml/alerts/${id}/escalate`, { reason: justification });
      }
      navigate('/compliance');
    } catch (err: any) {
      setActionError(err?.detail || "Échec de l'action");
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!alert) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <p className="text-destructive font-medium">Alerte introuvable</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/compliance')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerte AML — {alert.clientName || alert.client_name}</h1>
          <p className="text-muted-foreground mt-1">NIU: {alert.niu} · {new Date(alert.createdAt || alert.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Sévérité</p>
              <Badge className={severityColors[alert.severity] || ''}>{alert.severity}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <Badge variant={alert.status === 'OPEN' ? 'default' : 'secondary'}>{alert.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Correspondances détectées</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alert.hits?.length > 0 ? (
              alert.hits.map((hit: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{hit.listName}</p>
                    <Badge variant="secondary">{Math.round((hit.matchScore || hit.match_score) * 100)}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{hit.matchedName} — {hit.country}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune correspondance détaillée</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Action</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Justification obligatoire pour cette action..."
            className="min-h-[80px]"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAction('clear')}
              disabled={actionLoading || !justification.trim()}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />Faux positif
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleAction('confirm')}
              disabled={actionLoading || !justification.trim()}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />Confirmer match
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => handleAction('escalate')}
              disabled={actionLoading || !justification.trim()}
            >
              <ArrowUp className="h-4 w-4 mr-2" />Escalader
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
