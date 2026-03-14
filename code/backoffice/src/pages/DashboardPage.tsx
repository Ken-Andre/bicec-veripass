import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { FileCheck, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    { name: 'Dossiers en attente', value: '12', icon: Clock, color: 'text-yellow-600' },
    { name: 'Validés aujourd\'hui', value: '8', icon: CheckCircle, color: 'text-green-600' },
    { name: 'Alertes AML', value: '3', icon: AlertTriangle, color: 'text-red-600' },
    { name: 'À traiter', value: '5', icon: FileCheck, color: 'text-blue-600' },
  ]

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
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
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
              {[
                { action: 'Dossier #1234 validé', time: 'Il y a 5 min', user: 'Jean' },
                { action: 'Alerte AML résolue', time: 'Il y a 15 min', user: 'Thomas' },
                { action: 'Nouveau dossier soumis', time: 'Il y a 30 min', user: 'Marie' },
                { action: 'Batch provisioning lancé', time: 'Il y a 1h', user: 'Thomas' },
              ].map((item) => (
                <div key={item.action} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-gray-500">par {item.user}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item.time}</span>
                </div>
              ))}
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
                <span className="text-sm font-medium">1.2h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Taux de respect SLA</span>
                <span className="text-sm font-medium text-green-600">94%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Dossiers en retard</span>
                <span className="text-sm font-medium text-red-600">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Agents disponibles</span>
                <span className="text-sm font-medium">3/4</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}