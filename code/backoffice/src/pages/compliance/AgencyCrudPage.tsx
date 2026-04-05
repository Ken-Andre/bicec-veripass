/**
 * AgencyCrudPage — CRUD Agences pour Thomas/Admin IT
 */
import { useAgencies } from '@/hooks/useQueryHooks';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import { Plus, Edit2 } from 'lucide-react';

export default function AgencyCrudPage() {
  const { data: agencies, isLoading } = useAgencies();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des agences</h1>
          <p className="text-muted-foreground mt-1">Liste des agences BICEC</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> Nouvelle agence</Button>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="py-12 text-center text-muted-foreground">Chargement...</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Région</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(agencies || []).map((a: { id: string; code: string; name: string; city: string; region?: string; agentCount: number; isActive: boolean }) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.city}</TableCell>
                  <TableCell>{a.region || '—'}</TableCell>
                  <TableCell>{a.agentCount}</TableCell>
                  <TableCell>
                    <Badge variant={a.isActive ? 'default' : 'secondary'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm"><Edit2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!agencies || agencies.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune agence</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}