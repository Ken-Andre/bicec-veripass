import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Search, AlertTriangle, CheckCircle, XCircle, Shield } from 'lucide-react'

interface AMLAlert {
  id: string
  sessionId: string
  fullName: string
  dateOfBirth: string
  matchScore: number
  status: 'OPEN' | 'CLEARED' | 'CONFIRMED'
  source: string
}

const mockAlerts: AMLAlert[] = [
  { id: 'AML-001', sessionId: 'session-003', fullName: 'Alhadji Moussa', dateOfBirth: '12/05/1975', matchScore: 0.87, status: 'OPEN', source: 'PEP - Liste nationale' },
  { id: 'AML-002', sessionId: 'session-005', fullName: 'Mohamadou Saleh', dateOfBirth: '23/08/1980', matchScore: 0.72, status: 'OPEN', source: 'Sanctions UE' },
  { id: 'AML-003', sessionId: 'session-007', fullName: 'Ibrahim Tanko', dateOfBirth: '01/03/1965', matchScore: 0.91, status: 'OPEN', source: 'PEP - Liste internationale' },
]

export default function CompliancePage() {
  const [alerts, setAlerts] = useState<AMLAlert[]>(mockAlerts)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<AMLAlert | null>(null)

  const filteredAlerts = alerts.filter(alert => alert.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || alert.source.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleClearAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, status: 'CLEARED' as const } : alert))
    setSelectedAlert(null)
  }

  const handleConfirmAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => alert.id === alertId ? { ...alert, status: 'CONFIRMED' as const } : alert))
    setSelectedAlert(null)
  }

  const getStatusBadge = (status: AMLAlert['status']) => {
    switch (status) {
      case 'OPEN': return <Badge variant="danger">Ouverte</Badge>
      case 'CLEARED': return <Badge variant="success">Effacée</Badge>
      case 'CONFIRMED': return <Badge variant="warning">Confirmée</Badge>
    }
  }

  const openAlerts = alerts.filter(a => a.status === 'OPEN').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Conformité AML/CFT</h1>
        <p className="text-slate-500">Examinez les alertes PEP et sanctions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><AlertTriangle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{openAlerts}</p><p className="text-sm text-slate-500">Alertes ouvertes</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><CheckCircle className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{alerts.filter(a => a.status === 'CLEARED').length}</p><p className="text-sm text-slate-500">Faux positifs</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><Shield className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{alerts.filter(a => a.status === 'CONFIRMED').length}</p><p className="text-sm text-slate-500">Confirmées</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Alertes PEP/Sanctions</CardTitle><CardDescription>{openAlerts} alertes à examiner</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Rechercher par nom ou source..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-slate-50 ${selectedAlert?.id === alert.id ? 'border-slate-900 bg-slate-50' : ''}`} onClick={() => setSelectedAlert(alert)}>
                    <div className="flex items-center justify-between"><span className="font-medium">{alert.fullName}</span>{getStatusBadge(alert.status)}</div>
                    <div className="mt-1 text-sm text-slate-500">Score: {(alert.matchScore * 100).toFixed(0)}%</div>
                    <div className="mt-1 text-xs text-slate-400">{alert.source}</div>
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
                  <div><CardTitle>{selectedAlert.fullName}</CardTitle><CardDescription>Né(e) le {selectedAlert.dateOfBirth}</CardDescription></div>
                  {getStatusBadge(selectedAlert.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-sm text-slate-500">Score de correspondance</p><p className="text-2xl font-bold">{(selectedAlert.matchScore * 100).toFixed(0)}%</p></div>
                  <div><p className="text-sm text-slate-500">Source</p><p className="text-lg font-medium">{selectedAlert.source}</p></div>
                  <div><p className="text-sm text-slate-500">Session ID</p><p className="font-mono text-sm">{selectedAlert.sessionId}</p></div>
                  <div><p className="text-sm text-slate-500">Alert ID</p><p className="font-mono text-sm">{selectedAlert.id}</p></div>
                </div>
                {selectedAlert.status === 'OPEN' && (
                  <div className="flex gap-4 border-t pt-6">
                    <Button variant="outline" className="flex-1" onClick={() => handleClearAlert(selectedAlert.id)}><CheckCircle className="mr-2 h-4 w-4" />Faux positif</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleConfirmAlert(selectedAlert.id)}><XCircle className="mr-2 h-4 w-4" />Confirmer match</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="flex h-96 items-center justify-center"><div className="text-center"><Shield className="mx-auto h-12 w-12 text-slate-300" /><p className="mt-4 text-slate-500">Sélectionnez une alerte pour voir les détails</p></div></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  )
}
