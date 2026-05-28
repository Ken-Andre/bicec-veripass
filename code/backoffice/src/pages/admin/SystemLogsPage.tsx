import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useAuditLog } from '@/hooks/useQueryHooks';
import { apiDownload } from '@/services/api-client';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { ActionType } from '@/types';

type AuditEntry = {
  id: string;
  timestamp: string;
  agentName?: string;
  actionType: string;
  sessionId?: string;
  previousState?: string;
  newState?: string;
  rationale?: string;
};

const actionColorMap: Record<string, string> = {
  APPROVE: 'bg-green-100 text-green-800',
  REJECT: 'bg-red-100 text-red-800',
  REQUEST_INFO: 'bg-yellow-100 text-yellow-800',
  ASSIGN: 'bg-blue-100 text-blue-800',
  AML_CLEAR: 'bg-green-100 text-green-800',
  AML_CONFIRM: 'bg-red-100 text-red-800',
  AML_ESCALATE: 'bg-orange-100 text-orange-800',
  SYSTEM_AUTO: 'bg-gray-100 text-gray-600',
  KYC_REVIEW_APPROVED: 'bg-green-100 text-green-800',
  KYC_REVIEW_REJECTED: 'bg-red-100 text-red-800',
  KYC_REVIEW_INFO_REQUESTED: 'bg-yellow-100 text-yellow-800',
  DOSSIER_AUTO_ASSIGN: 'bg-blue-100 text-blue-800',
  DOCUMENT_CLASSIFY: 'bg-slate-100 text-slate-700',
  KYC_SUBMIT: 'bg-indigo-100 text-indigo-800',
  COMPLIANCE_GLOBAL_NOTIFICATION: 'bg-purple-100 text-purple-800',
};

const decisionActions = new Set([
  'KYC_REVIEW_APPROVED',
  'KYC_REVIEW_REJECTED',
  'KYC_REVIEW_INFO_REQUESTED',
  'APPROVE',
  'REJECT',
  'REQUEST_INFO',
  'AML_CLEAR',
  'AML_CONFIRM',
  'AML_ESCALATE',
]);

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export default function SystemLogsPage() {
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>('ALL');
  const [exporting, setExporting] = useState(false);
  const { data: entries, isLoading } = useAuditLog();

  async function handleCobacExport() {
    setExporting(true);
    try {
      const dateTo = new Date();
      const dateFrom = new Date(dateTo);
      dateFrom.setDate(dateFrom.getDate() - 30);
      const query = new URLSearchParams({
        date_from: dateFrom.toISOString().slice(0, 10),
        date_to: dateTo.toISOString().slice(0, 10),
      });
      const { blob, filename } = await apiDownload(`/audit/audit-log/export-cobac?${query.toString()}`);
      triggerDownload(blob, filename || `rapport-cobac-audit-${dateTo.toISOString().slice(0, 10)}.html`);
    } finally {
      setExporting(false);
    }
  }

  const auditEntries = (entries || []) as AuditEntry[];

  const filtered = useMemo(() => auditEntries.filter((entry) => {
    const haystack = [
      entry.agentName || 'Systeme',
      entry.actionType,
      entry.sessionId || '',
      entry.previousState || '',
      entry.newState || '',
      entry.rationale || '',
    ].join(' ').toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    const matchAction = actionType === 'ALL' || entry.actionType === actionType;
    return matchSearch && matchAction;
  }), [auditEntries, actionType, search]);

  const stats = useMemo(() => {
    const distinctActors = new Set(auditEntries.map((entry) => entry.agentName || 'Systeme')).size;
    return {
      total: auditEntries.length,
      distinctActors,
      decisions: auditEntries.filter((entry) => decisionActions.has(entry.actionType)).length,
      riskActions: auditEntries.filter((entry) => (
        entry.actionType.includes('REJECT')
        || entry.actionType.includes('AML')
        || entry.actionType.includes('FRAUD')
      )).length,
    };
  }, [auditEntries]);

  const { page, setPage, pageData, totalPages, totalItems } = usePagination(filtered, 15);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal d'audit</h1>
          <p className="text-muted-foreground mt-1">Controle des actions agents, systeme et decisions KYC</p>
        </div>
        <Button variant="outline" onClick={handleCobacExport} disabled={exporting}>
          <FileText className="h-4 w-4 mr-2" />
          {exporting ? 'Generation...' : 'Rapport COBAC'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Actions auditees</p>
              <Activity className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Acteurs</p>
              <Users className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.distinctActors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Decisions</p>
              <ShieldCheck className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.decisions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Actions a risque</p>
              <AlertTriangle className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-bold">{stats.riskActions}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par agent, action, dossier ou justification..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="w-[220px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type d'action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les actions</SelectItem>
                {Object.values(ActionType).map((type) => (
                  <SelectItem key={type} value={type}>{formatLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <CardContent className="py-12 text-center text-muted-foreground">Chargement...</CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Acteur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Dossier</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Justification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pageData as AuditEntry[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune entree</TableCell>
                  </TableRow>
                ) : (
                  (pageData as AuditEntry[]).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {formatDate(entry.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">{entry.agentName || 'Systeme'}</TableCell>
                      <TableCell>
                        <Badge className={actionColorMap[entry.actionType] || 'bg-muted'}>
                          {formatLabel(entry.actionType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.sessionId ? `${entry.sessionId.slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs">{entry.previousState || '-'}</span>
                        <span className="mx-1 text-muted-foreground">-&gt;</span>
                        <span className="font-mono text-xs">{entry.newState || '-'}</span>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={entry.rationale || ''}>
                        {entry.rationale || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page}/{totalPages} ({totalItems} entrees)
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Precedent
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Suivant <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
