/**
 * ConflictResolverPage — Résolution de conflits NIU pour Thomas
 * Source: veripass-gatekeeper prototype
 */
import { useNiuConflicts } from '@/hooks/useQueryHooks';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import { ChevronLeft, ChevronRight, GitMerge, AlertTriangle, Loader2, X } from 'lucide-react';
import { useState } from 'react';

export default function ConflictResolverPage() {
  const { data: conflicts, isLoading } = useNiuConflicts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { page, setPage, pageData, totalPages, totalItems } = usePagination(conflicts || [], 5);

  const selected = (conflicts || []).find((c: { id: string }) => c.id === selectedId);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Résolution de conflits NIU</h1>
        <p className="text-muted-foreground mt-1">Déduplication d'identité — {totalItems} conflit{totalItems !== 1 ? 's' : ''}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Conflits détectés</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIU</TableHead>
                <TableHead>Score similarité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pageData as Array<{ id: string; niu: string; similarityScore: number; status: string }>).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun conflit</TableCell></TableRow>
              ) : (
                (pageData as Array<{ id: string; niu: string; similarityScore: number; status: string }>).map((c) => (
                  <TableRow key={c.id} className={selectedId === c.id ? 'bg-muted/50' : ''}>
                    <TableCell className="font-mono">{c.niu}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${c.similarityScore > 0.8 ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${c.similarityScore * 100}%` }} />
                        </div>
                        <span className="text-sm">{Math.round(c.similarityScore * 100)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'PENDING' ? 'default' : 'secondary'}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={selectedId === c.id ? 'default' : 'outline'} onClick={() => setSelectedId(c.id)}>
                        Examiner
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page}/{totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selected && (
        <Card className="border-warning/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Comparaison détaillée — {selected.niu}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Session A */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Session A</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{selected.sessionA.id?.slice(0, 8)}...</p>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Créée le: {new Date(selected.sessionA.createdAt).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-muted-foreground">Confiance: {Math.round(selected.sessionA.confidence * 100)}%</p>
                  </div>
                </CardContent>
              </Card>
              {/* Session B */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Session B</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{selected.sessionB.id?.slice(0, 8)}...</p>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Créée le: {new Date(selected.sessionB.createdAt).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-muted-foreground">Confiance: {Math.round(selected.sessionB.confidence * 100)}%</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="flex gap-3 mt-4">
              <Button className="flex-1"><GitMerge className="h-4 w-4 mr-2" /> Fusionner</Button>
              <Button variant="destructive" className="flex-1"><X className="h-4 w-4 mr-2" /> Marquer fraude</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}