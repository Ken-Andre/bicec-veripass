import { useQueue, useQueueStats } from '@/hooks/useQueryHooks';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select';
import { AlertTriangle, Eye, Filter, Search, Loader2, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import type { QueueItem } from '@/services/dossier-service';

const labelsByStatus: Record<string, string> = {
  PENDING_AGENT_REVIEW: 'En attente',
  PENDING_KYC: 'En attente',
  APPROVED: 'Approuve',
  REJECTED: 'Rejete',
  FRAUD_SUSPECT: 'Fraude suspectee',
  PENDING_INFO: 'Infos requises',
};

function getStatusBadge(status: string) {
  const variants: Record<string, 'warning' | 'default' | 'success' | 'danger' | 'secondary'> = {
    PENDING_AGENT_REVIEW: 'warning',
    PENDING_KYC: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    FRAUD_SUSPECT: 'danger',
    PENDING_INFO: 'secondary',
  };
  const labels: Record<string, string> = {
    PENDING_AGENT_REVIEW: 'En attente',
    PENDING_KYC: 'En attente',
    APPROVED: 'Approuvé',
    REJECTED: 'Rejeté',
    FRAUD_SUSPECT: 'Fraude suspectée',
    PENDING_INFO: 'Infos requises',
  };
  return (
    <Badge variant={variants[status] || 'default'}>
      {labels[status] || status}
    </Badge>
  );
}

export default function ValidationQueuePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const apiStatus = statusFilter === 'ACTIVE' ? undefined : statusFilter;
  const { data: sessions, isLoading, error } = useQueue(apiStatus);
  const { data: queueStats } = useQueueStats();

  const filtered = useMemo(() => {
    if (!sessions) return [];
    let result = sessions as QueueItem[];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const name = (s.client_name || '').toLowerCase();
        const phone = (s.client_phone || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || s.id.toLowerCase().includes(q);
      });
    }
    return result;
  }, [sessions, search]);

  const queueCounts = {
    pending: queueStats?.pending ?? 0,
    review: queueStats?.info_required ?? 0,
    aml: queueStats?.fraud_suspect ?? 0,
    approved: queueStats?.approved ?? 0,
  };

  const { page, setPage, pageData, totalPages, totalItems } = usePagination(filtered, 10);

  const unassignedItems = useMemo(() => {
    if (statusFilter !== 'ACTIVE') return [];
    return (sessions as QueueItem[] || []).filter((s) => !s.assigned_agent_name);
  }, [sessions, statusFilter]);

  const scopeLabel = statusFilter === 'ACTIVE' ? 'a traiter' : (labelsByStatus[statusFilter] || statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement de la file...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader><CardTitle className="text-destructive">Erreur de chargement</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Impossible de charger la file des dossiers. Vérifiez la connexion à l'API.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File de validation</h1>
          <p className="text-muted-foreground mt-1">
            Dossiers KYC {scopeLabel} — {totalItems} dossier{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const first = unassignedItems[0];
              if (first) navigate(`/validation/dossier/${first.id}`);
            }}
            disabled={statusFilter !== 'ACTIVE' || unassignedItems.length === 0}
            title="Prendre le prochain dossier non assigné"
          >
            <UserCheck className="h-4 w-4 mr-1" />
            Prendre un dossier
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { key: 'pending', label: 'En attente', value: queueCounts.pending, color: 'bg-yellow-100 text-yellow-800' },
          { key: 'info-required', label: 'Infos requises', value: queueCounts.review, color: 'bg-blue-100 text-blue-800' },
          { key: 'aml', label: 'AML en cours', value: queueCounts.aml, color: 'bg-purple-100 text-purple-800' },
          { key: 'approved', label: 'Approuvés', value: queueCounts.approved, color: 'bg-green-100 text-green-800' },
        ].map((stat) => (
          <Card key={stat.label} data-testid={`queue-stat-${stat.key}`}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, téléphone ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[220px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Dossiers actifs</SelectItem>
                <SelectItem value="PENDING_AGENT_REVIEW">En attente</SelectItem>
                <SelectItem value="PENDING_INFO">Infos requises</SelectItem>
                <SelectItem value="FRAUD_SUSPECT">Fraude suspectée</SelectItem>
                <SelectItem value="APPROVED">Approuvé</SelectItem>
                <SelectItem value="REJECTED">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Assigné à</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Soumis le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun dossier trouvé
                </TableCell>
              </TableRow>
            ) : (
              (pageData as QueueItem[]).map((session) => {
                const biometricRiskFlags = session.biometric_risk_flags || [];
                return (
                <TableRow key={session.id} className={biometricRiskFlags.length > 0 ? 'bg-orange-50/40' : undefined}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>{session.client_name || session.client_phone || '—'}</div>
                      {(session.priority_flag || biometricRiskFlags.length > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {session.priority_flag && <Badge variant="warning">Prioritaire</Badge>}
                          {biometricRiskFlags.length > 0 && (
                            <Badge variant="warning" className="gap-1 border border-orange-200 bg-orange-100 text-orange-800">
                              <AlertTriangle className="h-3 w-3" />
                              Biometrie
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(session.status)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.assigned_agent_name || <span className="text-xs italic">Non assigné</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.agency_code || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {session.submitted_at ? new Date(session.submitted_at).toLocaleDateString('fr-FR') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/validation/dossier/${session.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Inspecter
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} ({totalItems} dossiers)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
