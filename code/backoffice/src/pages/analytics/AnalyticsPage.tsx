import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { BarChart3, TrendingUp, TrendingDown, Users, Target, Clock } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500">Tableaux de bord et métriques de performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><TrendingUp className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">94%</p><p className="text-sm text-slate-500">Taux de conversion</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><TrendingDown className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">6%</p><p className="text-sm text-slate-500">Taux d'abandon</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><Users className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">156</p><p className="text-sm text-slate-500">Dossiers ce mois</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><Clock className="h-8 w-8 text-purple-500" /><div><p className="text-2xl font-bold">1.2h</p><p className="text-sm text-slate-500">Délai moyen</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Funnel de conversion</CardTitle><CardDescription>Étapes du parcours onboarding</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { step: 'Début onboarding', count: 200, rate: 100 },
                { step: 'CNI capturée', count: 185, rate: 92.5 },
                { step: 'Liveness validé', count: 175, rate: 87.5 },
                { step: 'Dossier soumis', count: 170, rate: 85 },
                { step: 'Validé Jean', count: 160, rate: 80 },
                { step: 'Activé', count: 156, rate: 78 },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-32 text-sm">{item.step}</div>
                  <div className="flex-1"><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${item.rate}%` }} /></div></div>
                  <div className="w-16 text-right text-sm font-medium">{item.count}</div>
                  <div className="w-12 text-right text-sm text-slate-500">{item.rate}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Performance agents</CardTitle><CardDescription>Charge et efficacité par agent</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Jean', role: 'JEAN', dossiers: 12, avgTime: '1.1h', slaRate: 96 },
                { name: 'Marie', role: 'JEAN', dossiers: 8, avgTime: '1.3h', slaRate: 92 },
                { name: 'Paul', role: 'JEAN', dossiers: 10, avgTime: '1.0h', slaRate: 98 },
              ].map((agent, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{agent.name}</p><p className="text-sm text-slate-500">{agent.role} • {agent.dossiers} dossiers</p></div>
                  <div className="text-right"><p className="font-medium">{agent.avgTime}</p><p className="text-sm text-slate-500">SLA: {agent.slaRate}%</p></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}