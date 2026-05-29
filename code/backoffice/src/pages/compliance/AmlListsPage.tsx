import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Database, Download, Loader2, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/Table';
import { useAuth } from '@/contexts/AuthContext';
import { useAmlLists } from '@/hooks/useQueryHooks';
import { confirmAmlListImport, downloadAmlListTemplate, dryRunAmlListImport } from '@/services/aml-service';
import type { AmlListImportReport } from '@/types/aml';

const typeColors: Record<string, string> = {
  PEP: 'bg-blue-100 text-blue-800',
  SANCTIONS: 'bg-red-100 text-red-800',
  ADVERSE_MEDIA: 'bg-purple-100 text-purple-800',
};

export default function AmlListsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: lists, isLoading, error } = useAmlLists();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AmlListImportReport | null>(null);
  const [loadingAction, setLoadingAction] = useState<'template' | 'dry-run' | 'import' | null>(null);

  const canImport = user?.role === 'THOMAS' || user?.role === 'ADMIN_IT';
  const canConfirmImport = !!file && report?.status === 'DRY_RUN' && report.failedRows === 0;

  const handleTemplateDownload = async () => {
    setLoadingAction('template');
    try {
      const { blob, filename } = await downloadAmlListTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || 'bicec_aml_list_template.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDryRun = async () => {
    if (!file) return;
    setLoadingAction('dry-run');
    try {
      setReport(await dryRunAmlListImport(file));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoadingAction('import');
    try {
      const result = await confirmAmlListImport(file);
      setReport(result);
      queryClient.invalidateQueries({ queryKey: ['aml-lists'] });
    } finally {
      setLoadingAction(null);
    }
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader><CardTitle className="text-destructive">Erreur de chargement</CardTitle></CardHeader>
        <CardContent>Impossible de charger les listes AML.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listes AML</h1>
          <p className="text-muted-foreground mt-1">Sources OpenSanctions et listes internes BICEC.</p>
        </div>
        <Button variant="outline" onClick={handleTemplateDownload} disabled={loadingAction === 'template'}>
          {loadingAction === 'template' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Template CSV
        </Button>
      </div>

      {canImport && (
        <Card>
          <CardHeader><CardTitle>Importer une liste interne</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setReport(null);
              }}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDryRun} disabled={!file || loadingAction !== null}>
                {loadingAction === 'dry-run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Valider le CSV
              </Button>
              <Button onClick={handleImport} disabled={!canConfirmImport || loadingAction !== null}>
                {loadingAction === 'import' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Confirmer l'import
              </Button>
            </div>
            {report && (
              <div className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  {report.failedRows > 0 ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                  {report.status} - {report.importedRows}/{report.totalRows} lignes importables
                </div>
                {report.errors.length > 0 && (
                  <ul className="space-y-1 text-red-700">
                    {report.errors.map((item) => (
                      <li key={`${item.row}-${item.message}`}>Ligne {item.row}: {item.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Registre des sources</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entrées actives</TableHead>
                  <TableHead>Dernière synchro</TableHead>
                  <TableHead>Dernier import</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lists || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucune liste chargee
                    </TableCell>
                  </TableRow>
                ) : (
                  (lists || []).map((item) => (
                    <TableRow key={item.source}>
                      <TableCell className="font-medium">{item.source}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[item.listType] || 'bg-muted'}>{item.listType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{item.activeCount}</TableCell>
                      <TableCell>{item.latestSyncedAt || 'N/A'}</TableCell>
                      <TableCell>
                        {item.latestImportStatus ? `${item.latestImportStatus} - ${item.latestImportAt ? new Date(item.latestImportAt).toLocaleString('fr-FR') : 'N/A'}` : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
