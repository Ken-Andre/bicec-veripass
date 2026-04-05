/**
 * FunnelAnalyticsPage — Entonnoir de conversion KYC pour Sylvie
 * Source: veripass-gatekeeper prototype + architecture §13.1
 * Mapping vers BICEC VeriPass — RBAC SYLVIE
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Données simulées en attendant l'API DWH
const funnelSteps = [
  { name: 'Initiés', value: 100, count: 240, color: 'hsl(var(--primary))' },
  { name: 'OCR traité', value: 85, count: 204, color: 'hsl(var(--primary))' },
  { name: 'Biométrie OK', value: 72, count: 173, color: 'hsl(var(--bicec-or))' },
  { name: 'AML passé', value: 68, count: 163, color: 'hsl(var(--bicec-or))' },
  { name: 'Validé agent', value: 55, count: 132, color: 'hsl(var(--success))' },
  { name: 'Approuvé', value: 48, count: 115, color: 'hsl(var(--success))' },
];

export default function FunnelAnalyticsPage() {
  // TODO: Remplacer par données réelles du DWH
  const loading = false;

  const handleExport = () => {
    // TODO: Implémenter export CSV depuis /api/v1/auth/export-cobac
    console.log('Export CSV en cours...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entonnoir KYC</h1>
          <p className="text-muted-foreground mt-1">Analyse du taux de conversion par étape</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Funnel Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Taux de conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelSteps}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: unknown) => [`${Number(value) ?? 0}%`, 'Conversion']}
                />
                <Bar dataKey="value" name="Conversion" radius={[4, 4, 0, 0]}>
                  {funnelSteps.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stats detailed */}
        {funnelSteps.map((step) => (
          <Card key={step.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{step.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{step.count}</p>
                  <p className="text-xs text-muted-foreground">{step.value}% du total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}