/**
 * ValidationQueuePage — File d'attente des dossiers KYC pour Jean
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — RBAC JEAN, sans données mock
 * API: GET /api/v1/backoffice/dossiers
 */
import { useQueue } from '@/hooks/useQueryHooks';
import { usePagination } from '@/hooks/usePagination';
import { StatusChip } from '@/components/shared/StatusChip';
import { ConfidenceBar } from '@/components/shared/ConfidenceBar';
import { FlagBadge } from '@/components/shared/FlagBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select';
import { Eye, Filter, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { KycStatus, DossierFlag } from '@/types';

export default function ValidationQueuePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const { data: sessions, isLoading, error } = useQueue();

  const filtered = useMemo(() => {
    if (!sessions) return [];
    let result = sessions;
    if (statusFilter !== 'ALL') {
      result = result.filter((s: { status: string }) => s.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s: { clientIdentity?: { lastName: string; firstName: string }; niu?: string; id: string }) => {
        const name = `${s.clientIdentity?.lastName || ''} ${s.clientIdentity?.firstName || ''}`.toLowerCase();
        return name.includes(q) || (s.niu || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      });
    }
    return result;
  }, [sessions, statusFilter, search]);

  const { page, setPage, pageData, totalPages, totalItems } = usePagination(filtered, 10);

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">File de validation</h1>
        <p className="text-muted-foreground mt-1">
          Dossiers KYC en attente de revue — {totalItems} dossier{totalItems !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'En attente', status: KycStatus.PENDING_REVIEW, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'En révision', status: KycStatus.MANUAL_REVIEW, color: 'bg-blue-100 text-blue-800' },
          { label: 'AML en cours', status: KycStatus.AML_CHECK, color: 'bg-purple-100 text-purple-800' },
          { label: 'Approuvés', status: KycStatus.APPROVED, color: 'bg-green-100 text-green-800' },
        ].map((stat) => {
          const count = sessions?.filter((s: { status: string }) => s.status === stat.status).length || 0;
          return (
            <Card key={stat.status}>
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, NIU ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                {Object.values(KycStatus).map((status) => (
                  <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Confiance</TableHead>
              <TableHead>Drapeaux</TableHead>
              <TableHead>Agence</TableHead>
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
              (pageData as Array<{
                id: string; clientIdentity?: { lastName: string; firstName: string };
                status: string; overallConfidence?: number; flags?: DossierFlag[];
                agencyCode?: string;
              }>).map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    {[session.clientIdentity?.lastName, session.clientIdentity?.firstName].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={session.status} />
                  </TableCell>
                  <TableCell className="w-[140px]">
                    {session.overallConfidence != null && (
                      <ConfidenceBar score={session.overallConfidence} size="sm" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {session.flags?.map((flag) => (
                        <FlagBadge key={flag} flag={flag} compact />
                      )) || <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{session.agencyCode || '—'}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
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