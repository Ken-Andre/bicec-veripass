import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { FileCheck, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { fetchDashboardStats } from '../services/dossier-service'

interface DashboardData {
  summary: {
    name: string
    value: string
    icon: string
    color: string
  }[]
  recent_activity: {
    action: string
    time: string
    user: string
  }[]
  sla: {
    avg_validation_time: string
    sla_respect_rate: string
    late_dossiers: number
  }
}

const iconMap: Record<string, any> = {
  Clock,
  CheckCircle,
  AlertTriangle,
  FileCheck,
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await fetchDashboardStats()
        setData(stats)
      } catch (err) {
        console.error('Failed to load dashboard stats:', err)
        setError('Impossible de charger les statistiques')
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenue, {user?.name}
        </h1>
        <p className="text-gray-500">
          Voici un aperçu de votre activité aujourd'hui
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data?.summary.map((stat) => {
          const Icon = iconMap[stat.icon] || Clock
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.name}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>
              Les dernières actions sur les dossiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recent_activity.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-gray-500">par {item.user}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(item.time).toLocaleTimeString()}</span>
                </div>
              ))}
              {data?.recent_activity.length === 0 && (
                <p className="text-sm text-gray-500">Aucune activité récente</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance SLA</CardTitle>
            <CardDescription>
              Respect des délais de traitement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Délai moyen de validation</span>
                <span className="text-sm font-medium">{data?.sla.avg_validation_time}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Taux de respect SLA</span>
                <span className="text-sm font-medium text-green-600">{data?.sla.sla_respect_rate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Dossiers en retard</span>
                <span className="text-sm font-medium text-red-600">{data?.sla.late_dossiers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Statut système</span>
                <span className="text-sm font-medium text-green-600">Opérationnel</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
