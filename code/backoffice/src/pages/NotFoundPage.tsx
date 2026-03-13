import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page non trouvée</p>
        <p className="mt-2 text-gray-500">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Home className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/validation/ValidationDeskPage.tsx</path>
<content>import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { CheckCircle, XCircle, Eye, AlertCircle } from 'lucide-react'
import type { Dossier } from '../../types'

const mockDossiers: Dossier[] = [
  {
    id: '1',
    sessionId: 'session-001',
    clientName: 'Marie Ngono',
    clientPhone: '+237 6XX XXX XXX',
    status: 'PENDING_KYC',
    priority: 'HIGH',
    submittedAt: '2026-03-13T09:30:00Z',
    documents: [
      {
        id: 'doc-1',
        type: 'CNI_RECTO',
        filePath: '/documents/cni_recto.jpg',
        ocrFields: [
          { name: 'nom', value: 'NGONO', confidence: 0.95, humanCorrected: false },
          { name: 'prenom', value: 'Marie', confidence: 0.92, humanCorrected: false },
          { name: 'date_naissance', value: '15/03/1998', confidence: 0.88, humanCorrected: false },
        ],
        confidence: 0.92,
      },
    ],
  },
  {
    id: '2',
    sessionId: 'session-002',
    clientName: 'Jean-Pierre Mballa',
    clientPhone: '+237 6XX XXX XXX',
    status: 'PENDING_KYC',
    priority: 'MEDIUM',
    submittedAt: '2026-03-13T08:15:00Z',
    documents: [],
  },
  {
    id: '3',
    sessionId: 'session-003',
    clientName: 'Fatima Alhadji',
    clientPhone: '+237 6XX XXX XXX',
    status: 'COMPLIANCE_REVIEW',
    priority: 'HIGH',
    submittedAt: '2026-03-12T16:45:00Z',
    documents: [],
  },
]

export default function ValidationDeskPage() {
  const [dossiers] = useState<Dossier[]>(mockDossiers)
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null)

  const getStatusBadge = (status: Dossier['status']) => {
    switch (status) {
      case 'PENDING_KYC':
        return <Badge variant="warning">En attente</Badge>
      case 'COMPLIANCE_REVIEW':
        return <Badge variant="danger">Alerte AML</Badge>
      case 'READY_FOR_OPS':
        return <Badge variant="success">Prêt</Badge>
      case 'REJECTED':
        return <Badge variant="secondary">Rejeté</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: Dossier['priority']) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="danger">Haute</Badge>
      case 'MEDIUM':
        return <Badge variant="warning">Moyenne</Badge>
      default:
        return <Badge variant="secondary">Basse</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validation KYC</h1>
        <p className="text-gray-500">Examinez et validez les dossiers KYC des clients</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>File d'attente</CardTitle>
              <CardDescription>{dossiers.length} dossiers à traiter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dossiers.map((dossier) => (
                <div
                  key={dossier.id}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-gray-50 ${
                    selectedDossier?.id === dossier.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedDossier(dossier)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dossier.clientName}</span>
                    {getPriorityBadge(dossier.priority)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
                    <span>{dossier.clientPhone}</span>
                    {getStatusBadge(dossier.status)}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Soumis le {new Date(dossier.submittedAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedDossier ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedDossier.clientName}</CardTitle>
                    <CardDescription>{selectedDossier.clientPhone}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(selectedDossier.priority)}
                    {getStatusBadge(selectedDossier.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-4 text-lg font-medium">Documents</h3>
                  {selectedDossier.documents.length > 0 ? (
                    <div className="space-y-4">
                      {selectedDossier.documents.map((doc) => (
                        <div key={doc.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{doc.type}</span>
                            <Badge variant={doc.confidence >= 0.85 ? 'success' : 'warning'}>
                              Confiance: {(doc.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-2">
                            {doc.ocrFields.map((field, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{field.name}:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{field.value}</span>
                                  {field.confidence < 0.85 && (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {field.humanCorrected && (
                                    <Badge variant="secondary">Corrigé</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Aucun document disponible</p>
                  )}
                </div>

                <div className="flex gap-4 border-t pt-6">
                  <Button variant="outline" className="flex-1">
                    <Eye className="mr-2 h-4 w-4" />
                    Voir détails
                  </Button>
                  <Button variant="danger" className="flex-1">
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                  <Button className="flex-1">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approuver
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center">
                <p className="text-gray-500">Sélectionnez un dossier pour voir les détails</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/compliance/CompliancePage.tsx</path>
<content>import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import type { AMLAlert } from '../../types'

const mockAlerts: AMLAlert[] = [
  {
    id: '1',
    sessionId: 'session-003',
    pepSanctionsId: 'pep-001',
    matchScore: 0.87,
    status: 'OPEN',
    fullName: 'Alhadji Moussa',
    dateOfBirth: '12/05/1975',
    source: 'PEP - Liste nationale',
  },
  {
    id: '2',
    sessionId: 'session-005',
    pepSanctionsId: 'pep-002',
    matchScore: 0.72,
    status: 'OPEN',
    fullName: 'Mohamadou Saleh',
    dateOfBirth: '23/08/1980',
    source: 'Sanctions UE',
  },
  {
    id: '3',
    sessionId: 'session-007',
    pepSanctionsId: 'pep-003',
    matchScore: 0.91,
    status: 'OPEN',
    fullName: 'Ibrahim Tanko',
    dateOfBirth: '01/03/1965',
    source: 'PEP - Liste internationale',
  },
]

export default function CompliancePage() {
  const [alerts, setAlerts] = useState<AMLAlert[]>(mockAlerts)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<AMLAlert | null>(null)

  const filteredAlerts = alerts.filter(alert =>
    alert.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.source.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleClearAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, status: 'CLEARED' as const } : alert
    ))
    setSelectedAlert(null)
  }

  const handleConfirmAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, status: 'CONFIRMED' as const } : alert
    ))
    setSelectedAlert(null)
  }

  const getStatusBadge = (status: AMLAlert['status']) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="danger">Ouverte</Badge>
      case 'CLEARED':
        return <Badge variant="success">Effacée</Badge>
      case 'CONFIRMED':
        return <Badge variant="warning">Confirmée</Badge>
    }
  }

  const openAlerts = alerts.filter(a => a.status === 'OPEN').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conformité AML/CFT</h1>
        <p className="text-gray-500">Examinez les alertes PEP et sanctions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{openAlerts}</p>
                <p className="text-sm text-gray-500">Alertes ouvertes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.status === 'CLEARED').length}</p>
                <p className="text-sm text-gray-500">Faux positifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <XCircle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{alerts.filter(a => a.status === 'CONFIRMED').length}</p>
                <p className="text-sm text-gray-500">Confirmées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Alertes PEP/Sanctions</CardTitle>
              <CardDescription>{openAlerts} alertes à examiner</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom ou source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-gray-50 ${
                      selectedAlert?.id === alert.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{alert.fullName}</span>
                      {getStatusBadge(alert.status)}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Score: {(alert.matchScore * 100).toFixed(0)}%
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {alert.source}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedAlert ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedAlert.fullName}</CardTitle>
                    <CardDescription>Né(e) le {selectedAlert.dateOfBirth}</CardDescription>
                  </div>
                  {getStatusBadge(selectedAlert.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Score de correspondance</p>
                    <p className="text-2xl font-bold">
                      {(selectedAlert.matchScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Source</p>
                    <p className="text-lg font-medium">{selectedAlert.source}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Session ID</p>
                    <p className="font-mono text-sm">{selectedAlert.sessionId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">PEP/Sanctions ID</p>
                    <p className="font-mono text-sm">{selectedAlert.pepSanctionsId}</p>
                  </div>
                </div>

                {selectedAlert.status === 'OPEN' && (
                  <div className="flex gap-4 border-t pt-6">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleClearAlert(selectedAlert.id)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Faux positif
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => handleConfirmAlert(selectedAlert.id)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Confirmer match
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center">
                <p className="text-gray-500">Sélectionnez une alerte pour voir les détails</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/admin/AdminPage.tsx</path>
<content>import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Users, Building2, Settings, Plus } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-500">Gérez les agents, agences et configuration système</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gestion des agents
                </CardTitle>
                <CardDescription>Créez et gérez les comptes agents</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouvel agent
              </Button>
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
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{agent.role}</Badge>
                    <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                      {agent.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Gestion des agences
                </CardTitle>
                <CardDescription>Configurez les agences BICEC</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle agence
              </Button>
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
                  <div>
                    <p className="font-medium">{agency.name}</p>
                    <p className="text-sm text-gray-500">{agency.city} • {agency.agents} agents</p>
                  </div>
                  <Badge variant={agency.status === 'active' ? 'success' : 'secondary'}>
                    {agency.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration système
            </CardTitle>
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
                  <p className="text-sm text-gray-500">{config.label}</p>
                  <p className="text-xl font-bold">{config.value}</p>
                  <p className="text-xs text-gray-400">{config.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/analytics/AnalyticsPage.tsx</path>
<content>import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { BarChart3, TrendingUp, TrendingDown, Users } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500">Tableaux de bord et métriques de performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">94%</p>
                <p className="text-sm text-gray-500">Taux de conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingDown className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">6%</p>
                <p className="text-sm text-gray-500">Taux d'abandon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-sm text-gray-500">Dossiers ce mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">1.2h</p>
                <p className="text-sm text-gray-500">Délai moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funnel de conversion</CardTitle>
            <CardDescription>Étapes du parcours onboarding</CardDescription>
          </CardHeader>
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
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-medium">{item.count}</div>
                  <div className="w-12 text-right text-sm text-gray-500">{item.rate}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance agents</CardTitle>
            <CardDescription>Charge et efficacité par agent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Jean', role: 'JEAN', dossiers: 12, avgTime: '1.1h', slaRate: 96 },
                { name: 'Marie', role: 'JEAN', dossiers: 8, avgTime: '1.3h', slaRate: 92 },
                { name: 'Paul', role: 'JEAN', dossiers: 10, avgTime: '1.0h', slaRate: 98 },
              ].map((agent, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-gray-500">{agent.role} • {agent.dossiers} dossiers</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{agent.avgTime}</p>
                    <p className="text-sm text-gray-500">SLA: {agent.slaRate}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
</content>
<write_to_file>
<path>code/backoffice/src/pages/command-center/CommandCenterPage.tsx</path>
<content>import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { AlertTriangle, CheckCircle, RefreshCw, Download } from 'lucide-react'

export default function CommandCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
        <p className="text-gray-500">Vue d'ensemble et actions critiques</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div>
                <p className="text-2xl font-bold">Système OK</p>
                <p className="text-sm text-gray-500">Tous les services actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-gray-500">Dossiers en retard</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">3/4</p>
                <p className="text-sm text-gray-500">Agents disponibles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-gray-500">Files en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Violations SLA
            </CardTitle>
            <CardDescription>Dossiers dépassant le délai de 2h</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: 'session-045', client: 'Paul Biya', delay: '2h30', agent: 'Jean' },
                { id: 'session-048', client: 'Claudine Foko', delay: '2h15', agent: 'Marie' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div>
                    <p className="font-medium">{item.client}</p>
                    <p className="text-sm text-gray-500">ID: {item.id} • Agent: {item.agent}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{item.delay}</Badge>
                    <Button size="sm" variant="outline">
                      Escalader
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition de charge</CardTitle>
            <CardDescription>Distribution des dossiers par agent</CardDescription>
          </CardHeader>
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
                    <span className="text-sm text-gray-500">
                      {agent.current}/{agent.max} dossiers (poids: {agent.weight})
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full ${
                        agent.current / agent.max > 0.8 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(agent.current / agent.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Redistribuer
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
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}