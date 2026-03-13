import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Users, Building2, Settings, Plus } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
        <p className="text-slate-500">Gérez les agents, agences et configuration système</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Gestion des agents</CardTitle><CardDescription>Créez et gérez les comptes agents</CardDescription></div>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nouvel agent</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Jean Dupont', email: 'jean@bicec.cm', role: 'JEAN', status: 'active' },
                { name: 'Thomas Martin', email: 'thomas@bicec.cm', role: 'THOMAS', status: 'active' },
                { name: 'Sylvie Bernard', email: 'sylvie@bicec.cm', role: 'SYLVIE', status: 'active' },
              ].map((agent, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{agent.name}</p><p className="text-sm text-slate-500">{agent.email}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{agent.role}</Badge>
                    <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>{agent.status === 'active' ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Gestion des agences</CardTitle><CardDescription>Configurez les agences BICEC</CardDescription></div>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nouvelle agence</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Agence Douala Centre', city: 'Douala', agents: 3, status: 'active' },
                { name: 'Agence Yaoundé Poste', city: 'Yaoundé', agents: 2, status: 'active' },
                { name: 'Agence Bamenda', city: 'Bamenda', agents: 1, status: 'inactive' },
              ].map((agency, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{agency.name}</p><p className="text-sm text-slate-500">{agency.city} • {agency.agents} agents</p></div>
                  <Badge variant={agency.status === 'active' ? 'success' : 'secondary'}>{agency.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Configuration système</CardTitle>
            <CardDescription>Paramètres globaux de l'application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Seuil confiance OCR', value: '85%', description: 'En dessous, fallback GLM-OCR' },
                { label: 'Timeout session', value: '72h', description: 'Avant marquage ABANDONED' },
                { label: 'Fréquence sync PEP', value: 'Hebdo', description: 'Lundis à 02h00' },
                { label: 'Limites OTP', value: '5/15min', description: 'Tentatives avant lock' },
                { label: 'SLA validation', value: '2h', description: 'Délai cible Jean' },
                { label: 'Conservation docs', value: '10 ans', description: 'Conformité COBAC' },
              ].map((config, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <p className="text-sm text-slate-500">{config.label}</p>
                  <p className="text-xl font-bold">{config.value}</p>
                  <p className="text-xs text-slate-400">{config.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}