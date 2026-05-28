/**
 * ComplianceDashboard — Dashboard AML/CFT pour Thomas
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — RBAC THOMAS, données depuis API (no mock)
 */
import { useMemo } from 'react';
import { useAmlAlerts, useDocumentExpiry, useNiuConflicts } from '@/hooks/useQueryHooks';
import { usePagination } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';
import {
  ShieldAlert, GitMerge, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Loader2, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { AmlAlert, AmlSeverity } from '@/types';

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  CLEARED: 'bg-green-100 text-green-800',
  CONFIRMED: 'bg-red-100 text-red-800',
  ESCALATED: 'bg-purple-100 text-purple-800',
};

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const { data: alerts, isLoading: alertsLoading, error: alertsError } = useAmlAlerts();
  const { data: conflicts, isLoading: conflictsLoading } = useNiuConflicts();
  const { data: documentExpiry, isLoading: expiryLoading } = useDocumentExpiry();

  const pendingAlerts = alerts?.filter((a) => a.status === 'OPEN').length || 0;
  const criticalAlerts = alerts?.filter((a) => a.severity === 'CRITICAL').length || 0;

  const fpRate = useMemo(() => {
    if (!alerts?.length) return 0;
    const cleared = alerts.filter((a) => a.status === 'CLEARED').length;
    return Math.round((cleared / alerts.length) * 100);
  }, [alerts]);

  const weeklyData = useMemo(() => {
    if (!alerts?.length) return [];
    const weeks = new Map<
      string,
      { week: string; pending: number; cleared: number; confirmed: number }
    >();
    alerts.forEach((a) => {
      const d = new Date(a.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      if (!weeks.has(key)) weeks.set(key, { week: key, pending: 0, cleared: 0, confirmed: 0 });
      const entry = weeks.get(key)!;
      if (a.status === 'OPEN') entry.pending++;
      else if (a.status === 'CLEARED') entry.cleared++;
      else if (a.status === 'CONFIRMED') entry.confirmed++;
    });
    return Array.from(weeks.values());
  }, [alerts]);

  const {
    page,
    setPage,
    pageData,
    totalPages,
    totalItems,
  } = usePagination(alerts || [], 5);

  if (alertsError) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erreur de chargement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Impossible de charger les alertes AML.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conformité AML/CFT</h1>
        <p className="text-muted-foreground mt-1">Supervision des alertes et conflits NIU</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          {
            icon: ShieldAlert,
            value: pendingAlerts,
            label: 'Alertes ouvertes',
            color: 'bg-yellow-50 text-yellow-700',
          },
          {
            icon: AlertTriangle,
            value: criticalAlerts,
            label: 'Critiques',
            color: 'bg-red-50 text-red-700',
          },
          {
            icon: GitMerge,
            value: conflictsLoading ? '...' : conflicts?.length || 0,
            label: 'Conflits NIU',
            color: 'bg-orange-50 text-orange-700',
          },
          {
            icon: CheckCircle,
            value: `${fpRate}%`,
            label: 'Faux positifs',
            color: 'bg-green-50 text-green-700',
          },
          {
            icon: CalendarClock,
            value: expiryLoading ? '...' : documentExpiry?.total || 0,
            label: 'Documents à renouveler',
            color: 'bg-blue-50 text-blue-700',
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', item.color)}>
                <item.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents expirés / à renouveler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Notification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(documentExpiry?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun document à renouveler
                  </TableCell>
                </TableRow>
              ) : (
                (documentExpiry?.items || []).slice(0, 5).map((item) => (
                  <TableRow key={item.sessionId}>
                    <TableCell>
                      <p className="font-medium">{item.clientName}</p>
                      <p className="text-xs text-muted-foreground">{item.status} · {item.accessLevel}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('fr-FR') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={item.state === 'expired' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                        {item.state === 'expired' ? 'Expiré' : 'À renouveler'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.notifiedAt ? new Date(item.notifiedAt).toLocaleDateString('fr-FR') : 'Non notifié'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Chart */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertes par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="pending" name="En attente" fill="hsl(var(--warning))" stackId="a" />
                <Bar dataKey="cleared" name="Classé" fill="hsl(var(--success))" stackId="a" />
                <Bar dataKey="confirmed" name="Confirmé" fill="hsl(var(--destructive))" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Alert Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Alertes AML actives</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/compliance/duplicates')}>
            Conflits NIU →
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {alertsLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Correspondances</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune alerte
                      </TableCell>
                    </TableRow>
                  ) : (
                    (pageData as AmlAlert[]).map((alert: AmlAlert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <p className="font-medium">{alert.clientName}</p>
                          <p className="text-xs text-muted-foreground font-mono">NIU: {alert.niu}</p>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('font-semibold', severityColors[alert.severity as AmlSeverity] || 'bg-muted')}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('font-medium', statusColors[alert.status] || 'bg-muted')}>
                            {alert.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {alert.hits?.map((h) => (
                            <div key={h.id} className="text-sm">
                              <span className="font-medium">{h.listName}</span>
                              <span className="text-muted-foreground ml-1">({Math.round(h.matchScore * 100)}%)</span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {new Date(alert.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/compliance/alert/${alert.id}`)}>
                            Traiter
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
                    Page {page}/{totalPages} ({totalItems} alertes)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Suivant <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
