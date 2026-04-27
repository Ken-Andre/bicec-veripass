import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle, RefreshCw, Download, Activity, Loader2 } from 'lucide-react'
import { fetchDashboardStats } from '@/services/dossier-service'
import { apiGet } from '@/services/api-client'

export default function CommandCenterPage() {
  const [stats, setStats] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [dashboardData, agentsData] = await Promise.all([
          fetchDashboardStats(),
          apiGet('/admin/agents'),
        ])
        setStats(dashboardData)
        setAgents(agentsData.items || agentsData || [])
      } catch (err) {
        console.error('Failed to load command center:', err)
        setError('Impossible de charger les données')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
  }

  const pendingCount = parseInt(stats?.summary?.find((s: any) => s.name.includes('attente'))?.value || '0')
  const validatedToday = parseInt(stats?.summary?.find((s: any) => s.name.includes("Validés"))?.value || '0')
  const toTreat = parseInt(stats?.summary?.find((s: any) => s.name.includes('traiter'))?.value || '0')

  const jeanAgents = agents.filter((a: any) => a.role === 'JEAN')
  const availableAgents = jeanAgents.filter((a: any) => a.is_available)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <p className="text-slate-500">Vue d'ensemble et actions critiques</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full ${agents.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'} flex-shrink-0`} />
              <div>
                <p className="text-2xl font-bold">
                  {availableAgents.length}/{jeanAgents.length}
                </p>
                <p className="text-sm text-slate-500">Agents disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-slate-500">Dossiers en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{validatedToday}</p>
                <p className="text-sm text-slate-500">Validés aujourd'hui</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Activity className="h-8 w-8 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{toTreat}</p>
                <p className="text-sm text-slate-500">Files en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />Violations SLA
            </CardTitle>
            <CardDescription>Dossiers dépassant le délai de 2h</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                SLA respecté : {stats?.sla?.sla_respect_rate || '—'} · Délai moyen : {stats?.sla?.avg_validation_time || '—'}
              </p>
              {stats?.sla?.late_dossiers > 0 ? (
                <p className="text-sm text-red-600 font-medium">
                  {stats.sla.late_dossiers} dossier(s) en retard
                </p>
              ) : (
                <p className="text-sm text-green-600">Aucun dossier en retard</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition de charge</CardTitle>
            <CardDescription>Distribution des dossiers par agent JEAN</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jeanAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun agent JEAN trouvé</p>
              ) : (
                jeanAgents.map((agent: any) => {
                  const load = agent.active_dossier_count || 0
                  const maxPerAgent = 6
                  const pct = Math.min((load / maxPerAgent) * 100, 100)
                  return (
                    <div key={agent.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-sm text-slate-500">
                          {load}/{maxPerAgent} dossiers {!agent.is_available && <Badge variant="secondary" className="ml-2">Inactif</Badge>}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />Redistribuer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Export conformité COBAC</CardTitle>
            <CardDescription>Générez les rapports de conformité réglementaire</CardDescription>
          </CardHeader>
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
