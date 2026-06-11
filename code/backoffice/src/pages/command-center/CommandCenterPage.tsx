import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle, Download, Activity, Loader2, Wifi, Users } from 'lucide-react'
import { fetchDashboardStats } from '@/services/dossier-service'
import { apiGet } from '@/services/api-client'

type AgentLoad = {
  id: string
  name: string
  email: string
  role: string
  agency_id: string | null
  agency_code?: string | null
  agency_name?: string | null
  is_available: boolean
  is_connected?: boolean
  active_dossier_count: number
  active_queue_count?: number
  completed_dossier_count?: number
  total_assigned_count?: number
  last_activity_at?: string | null
}

export default function CommandCenterPage() {
  const [stats, setStats] = useState<any>(null)
  const [agents, setAgents] = useState<AgentLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [dashboardResult, agentsResult] = await Promise.allSettled([
        fetchDashboardStats(),
        apiGet('/backoffice/agents/load'),
      ])

      if (dashboardResult.status === 'fulfilled') {
        setStats(dashboardResult.value)
      } else {
        console.error('Failed to load command center stats:', dashboardResult.reason)
      }

      if (agentsResult.status === 'fulfilled') {
        const agentsData = agentsResult.value
        setAgents(agentsData.items || agentsData || [])
      } else {
        console.error('Failed to load command center agents:', agentsResult.reason)
      }

      if (dashboardResult.status === 'rejected' || agentsResult.status === 'rejected') {
        setError('Impossible de charger toutes les donnees')
      }

      setLoading(false)
    }
    load()
  }, [])

  const pendingCount = parseInt(stats?.summary?.find((s: any) => s.name.includes('attente'))?.value || '0')
  const validatedToday = parseInt(stats?.summary?.find((s: any) => s.name.includes('Valid'))?.value || '0')
  const toTreat = parseInt(stats?.summary?.find((s: any) => s.name.includes('traiter'))?.value || '0')

  const jeanAgents = agents.filter((a) => a.role === 'JEAN')
  const availableAgents = jeanAgents.filter((a) => a.is_available)
  const connectedAgents = jeanAgents.filter((a) => a.is_connected)
  const agencyLoads = useMemo(() => {
    const groups = new Map<string, {
      label: string
      agents: AgentLoad[]
      active: number
      completed: number
      totalAssigned: number
      available: number
      connected: number
    }>()
    jeanAgents.forEach((agent) => {
      const key = agent.agency_id || 'unassigned'
      const label = agent.agency_code || agent.agency_name || 'Sans agence'
      const current = groups.get(key) || {
        label,
        agents: [],
        active: 0,
        completed: 0,
        totalAssigned: 0,
        available: 0,
        connected: 0,
      }
      current.agents.push(agent)
      current.active += agent.active_queue_count ?? agent.active_dossier_count ?? 0
      current.completed += agent.completed_dossier_count ?? 0
      current.totalAssigned += agent.total_assigned_count ?? 0
      current.available += agent.is_available ? 1 : 0
      current.connected += agent.is_connected ? 1 : 0
      groups.set(key, current)
    })
    return Array.from(groups.values()).sort((a, b) => b.active - a.active || a.label.localeCompare(b.label))
  }, [jeanAgents])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Centre de pilotage</h1>
        <p className="text-slate-500">Vue d'ensemble et actions critiques</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center rounded-lg border bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {!loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Wifi className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">
                      {connectedAgents.length}/{jeanAgents.length}
                    </p>
                    <p className="text-sm text-slate-500">Agents connectés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-green-500 flex-shrink-0" />
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
                    SLA respecté : {stats?.sla?.sla_respect_rate || '-'} - Délai moyen : {stats?.sla?.avg_validation_time || '-'}
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
                <CardDescription>Charge active par agence, historique séparé</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agencyLoads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun agent JEAN trouve</p>
                  ) : (
                    agencyLoads.map((agency) => {
                      const capacity = Math.max(agency.available * 6, 1)
                      const pct = Math.min((agency.active / capacity) * 100, 100)
                      return (
                        <div key={agency.label} className="space-y-2 rounded-md border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{agency.label}</span>
                            <span className="text-sm text-slate-500">
                              {agency.active} actifs - {agency.completed} traités
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200">
                            <div className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <Badge variant="secondary">{agency.connected}/{agency.agents.length} connectés</Badge>
                            <Badge variant="secondary">{agency.available}/{agency.agents.length} disponibles</Badge>
                            <span>{agency.totalAssigned} affectations historiques</span>
                          </div>
                          <details className="text-sm">
                            <summary className="cursor-pointer text-slate-600">Voir agents</summary>
                            <div className="mt-2 space-y-2">
                              {agency.agents.map((agent) => (
                                <div key={agent.id} className="flex items-center justify-between gap-3 text-slate-600">
                                  <span>{agent.name}</span>
                                  <span className="text-right">
                                    {agent.active_queue_count ?? agent.active_dossier_count ?? 0} actifs - {agent.completed_dossier_count ?? 0} traités
                                    {!agent.is_connected && <Badge variant="secondary" className="ml-2">Hors ligne</Badge>}
                                    {!agent.is_available && <Badge variant="secondary" className="ml-2">Indisponible</Badge>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )
                    })
                  )}
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
        </>
      )}
    </div>
  )
}
