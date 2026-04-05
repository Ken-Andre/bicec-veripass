/**
 * AmlAlertDetailPage — Détail d'alerte AML pour Thomas
 */
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ArrowLeft, ShieldCheck, ShieldAlert, ArrowUp } from 'lucide-react';
import { useState } from 'react';

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

export default function AmlAlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [justification, setJustification] = useState('');
  const [_action, setAction] = useState<'clear' | 'confirm' | 'escalate' | null>(null);

  // TODO: Fetch alert from API
  const alert = {
    id: id || '',
    clientName: 'NGUEMO Marie',
    niu: 'M1234567890123',
    severity: 'HIGH',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    hits: [
      { listName: 'UN Sanctions', matchScore: 0.72, matchedName: 'NGUEMO Marie Claire', country: 'Cameroun' },
      { listName: 'EU FSF', matchScore: 0.65, matchedName: 'NGUEMO M.', country: 'Cameroun' },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerte AML — {alert.clientName}</h1>
          <p className="text-muted-foreground mt-1">NIU: {alert.niu} • {new Date(alert.createdAt).toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Alert Info */}
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Sévérité</p>
              <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <Badge variant={alert.status === 'PENDING' ? 'default' : 'secondary'}>{alert.status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Hits */}
        <Card>
          <CardHeader><CardTitle>Correspondances détectées</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alert.hits.map((hit, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{hit.listName}</p>
                  <Badge variant="secondary">{Math.round(hit.matchScore * 100)}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{hit.matchedName} — {hit.country}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action */}
      <Card>
        <CardHeader><CardTitle>Action de conformité</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Justification obligatoire..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAction('clear')} disabled={!justification.trim()}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Classer sans suite
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => setAction('confirm')} disabled={!justification.trim()}>
              <ShieldAlert className="h-4 w-4 mr-2" /> Confirmer risque
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setAction('escalate')} disabled={!justification.trim()}>
              <ArrowUp className="h-4 w-4 mr-2" /> Escalader
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}