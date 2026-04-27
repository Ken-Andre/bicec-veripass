/**
 * SystemLogsPage — Journal d'audit système pour Admin IT et Sylvie
 * Source: veripass-gatekeeper prototype
 * Mapping vers BICEC VeriPass — RBAC ADMIN_IT, SYLVIE
 */
import { useAuditLog } from '@/hooks/useQueryHooks';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/Select';
import { ChevronLeft, ChevronRight, Search, Filter, Download } from 'lucide-react';
import { useState, useMemo } from 'react';
import { ActionType } from '@/types';

const actionColorMap: Record<string, string> = {
  APPROVE: 'bg-green-100 text-green-800',
  REJECT: 'bg-red-100 text-red-800',
  REQUEST_INFO: 'bg-yellow-100 text-yellow-800',
  ASSIGN: 'bg-blue-100 text-blue-800',
  AML_CLEAR: 'bg-green-100 text-green-800',
  AML_CONFIRM: 'bg-red-100 text-red-800',
  AML_ESCALATE: 'bg-orange-100 text-orange-800',
  SYSTEM_AUTO: 'bg-gray-100 text-gray-600',
};

export default function SystemLogsPage() {
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>('ALL');
  const { data: entries, isLoading } = useAuditLog();

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      const matchSearch = !search || e.agentName.toLowerCase().includes(search.toLowerCase()) || e.rationale.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionType === 'ALL' || e.actionType === actionType;
      return matchSearch && matchAction;
    });
  }, [entries, search, actionType]);

  const { page, setPage, pageData, totalPages, totalItems } = usePagination(filtered, 15);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal d'audit</h1>
          <p className="text-muted-foreground mt-1">Historique complet des actions système</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par agent ou description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <CardContent className="py-12 text-center text-muted-foreground">Chargement...</CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Justification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pageData as Array<{
                  id: string; timestamp: string; agentName: string; actionType: string;
                  sessionId: string; previousState: string; newState: string; rationale: string;
                }>).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune entrée</TableCell>
                  </TableRow>
                ) : (
                  (pageData as Array<{
                    id: string; timestamp: string; agentName: string; actionType: string;
                    sessionId: string; previousState: string; newState: string; rationale: string;
                  }>).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{entry.agentName}</TableCell>
                      <TableCell>
                        <Badge className={actionColorMap[entry.actionType] || 'bg-muted'}>
                          {entry.actionType.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.sessionId?.slice(0, 8)}...</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs">{entry.previousState}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-mono text-xs">{entry.newState}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={entry.rationale}>
                        {entry.rationale}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page}/{totalPages} ({totalItems} entrées)
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
      </Card>
    </div>
  );
}