/**
 * OcrObservabilityPage — Métriques OCR pour Sylvie
 * Source: veripass-gatekeeper prototype + architecture §13.2
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const engineData = [
  { name: 'PaddleOCR', avgConfidence: 89, corrections: 12, total: 204 },
  { name: 'GLM-OCR', avgConfidence: 94, corrections: 5, total: 48 },
  { name: 'Hybrid', avgConfidence: 92, corrections: 8, total: 36 },
];

const fieldData = [
  { name: 'Nom', confidence: 96 },
  { name: 'Prénom', confidence: 94 },
  { name: 'Date Naiss.', confidence: 88 },
  { name: 'Lieu Naiss.', confidence: 72 },
  { name: 'N° CNI', confidence: 97 },
  { name: 'Adresse', confidence: 68 },
  { name: 'Date Exp.', confidence: 65 },
];

export default function OcrObservabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Observabilité OCR</h1>
        <p className="text-muted-foreground mt-1">Métriques de qualité d'extraction par moteur</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Confiance moyenne', value: '89%', color: 'text-green-600' },
          { label: 'Taux de correction', value: '7.3%', color: 'text-yellow-600' },
          { label: 'Documents traités', value: '288', color: 'text-primary' },
          { label: 'Échecs GLM', value: '3', color: 'text-red-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{stat.label}</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Engine Performance */}
      <Card>
        <CardHeader><CardTitle>Performance par moteur</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={engineData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="avgConfidence" name="Confiance moy. (%)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Field Confidence */}
      <Card>
        <CardHeader><CardTitle>Confiance par champ extrait</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={fieldData} layout="vertical">
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(v: unknown) => `${Number(v) ?? 0}%`} />
              <Bar dataKey="confidence" name="Confiance" radius={[0, 4, 4, 0]}>
                {fieldData.map((entry, i) => (
                  <Cell key={i} fill={entry.confidence >= 85 ? 'hsl(var(--success))' : entry.confidence >= 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" />{" >=85% (OK)"}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" />{" 60-84% (Revue)"}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" />{"{'<'}60% (GLM requis)"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}