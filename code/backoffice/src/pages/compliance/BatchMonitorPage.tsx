/**
 * BatchMonitorPage — Monitoring des jobs batch pour Thomas
 */
import { useBatchJobs } from '@/hooks/useQueryHooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Play, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
};

export default function BatchMonitorPage() {
  const { data: batches, isLoading } = useBatchJobs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoring des batches Amplitude</h1>
          <p className="text-muted-foreground mt-1">Provisionnement des comptes</p>
        </div>
        <Button><Play className="h-4 w-4 mr-2" /> Lancer un batch</Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Chargement...</CardContent></Card>
        ) : (
          (batches || []).map((b: { id: string; type: string; status: string; totalItems: number; processedItems: number; failedItems: number; startedAt?: string; completedAt?: string }) => {
            const progress = b.totalItems > 0 ? Math.round((b.processedItems / b.totalItems) * 100) : 0;
            return (
              <Card key={b.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {b.type === 'AMPLITUDE_PROVISIONING' ? 'Provisionnement Amplitude' : b.type}
                  </CardTitle>
                  <Badge className={statusColors[b.status] || 'bg-muted'}>{b.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={progress} />
                      <p className="text-xs text-muted-foreground mt-1">{progress}% — {b.processedItems}/{b.totalItems} traités</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Échecs: {b.failedItems}</p>
                      {b.startedAt && <p className="text-xs text-muted-foreground">{new Date(b.startedAt).toLocaleTimeString('fr-FR')}</p>}
                    </div>
                  </div>
                  {b.status === 'FAILED' && (
                    <Button size="sm" variant="outline"><RefreshCw className="h-3 w-3 mr-2" /> Réessayer</Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        {(!batches || batches.length === 0) && !isLoading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun batch</CardContent></Card>
        )}
      </div>
    </div>
  );
}