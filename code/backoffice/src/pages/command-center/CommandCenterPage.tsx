import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle, RefreshCw, Download, Activity } from 'lucide-react'

export default function CommandCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <p className="text-slate-500">Vue d'ensemble et actions critiques</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" /><div><p className="text-2xl font-bold">Système OK</p><p className="text-sm text-slate-500">Tous les services actifs</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><AlertTriangle className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">2</p><p className="text-sm text-slate-500">Dossiers en retard</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><CheckCircle className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">3/4</p><p className="text-sm text-slate-500">Agents disponibles</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><Activity className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">5</p><p className="text-sm text-slate-500">Files en attente</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Violations SLA</CardTitle><CardDescription>Dossiers dépassant le délai de 2h</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: 'session-045', client: 'Paul Biya', delay: '2h30', agent: 'Jean' },
                { id: 'session-048', client: 'Claudine Foko', delay: '2h15', agent: 'Marie' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div><p className="font-medium">{item.client}</p><p className="text-sm text-slate-500">ID: {item.id} • Agent: {item.agent}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{item.delay}</Badge>
                    <Button size="sm" variant="outline">Escalader</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Répartition de charge</CardTitle><CardDescription>Distribution des dossiers par agent</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Jean', weight: 2, current: 4, max: 6 },
                { name: 'Marie', weight: 1, current: 2, max: 4 },
                { name: 'Paul', weight: 1, current: 3, max: 4 },
              ].map((agent, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-sm text-slate-500">{agent.current}/{agent.max} dossiers (poids: {agent.weight})</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className={`h-2 rounded-full transition-all ${agent.current / agent.max > 0.8 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${(agent.current / agent.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1"><RefreshCw className="mr-2 h-4 w-4" />Redistribuer</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Export conformité COBAC</CardTitle><CardDescription>Générez les rapports de conformité réglementaire</CardDescription></CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export JSON</Button>
              <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export PDF</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}