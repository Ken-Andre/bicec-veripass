import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CheckCircle, XCircle, Eye, AlertCircle, Clock } from 'lucide-react'

interface Dossier {
  id: string
  clientName: string
  clientPhone: string
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  submittedAt: string
  documents: number
}

const mockDossiers: Dossier[] = [
  { id: 'DOSS-001', clientName: 'Marie Ngono', clientPhone: '+237 6XX XXX XXX', status: 'PENDING', priority: 'HIGH', submittedAt: '2026-03-13T09:30:00Z', documents: 3 },
  { id: 'DOSS-002', clientName: 'Jean-Pierre Mballa', clientPhone: '+237 6XX XXX XXX', status: 'IN_REVIEW', priority: 'MEDIUM', submittedAt: '2026-03-13T08:15:00Z', documents: 2 },
  { id: 'DOSS-003', clientName: 'Fatima Alhadji', clientPhone: '+237 6XX XXX XXX', status: 'PENDING', priority: 'LOW', submittedAt: '2026-03-12T16:45:00Z', documents: 4 },
]

export default function ValidationDesk() {
  const [dossiers] = useState<Dossier[]>(mockDossiers)
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null)

  const getStatusBadge = (status: Dossier['status']) => {
    switch (status) {
      case 'PENDING': return <Badge variant="warning"><Clock className="mr-1 h-3 w-3" />En attente</Badge>
      case 'IN_REVIEW': return <Badge variant="default"><Eye className="mr-1 h-3 w-3" />En cours</Badge>
      case 'APPROVED': return <Badge variant="success"><CheckCircle className="mr-1 h-3 w-3" />Approuvé</Badge>
      case 'REJECTED': return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" />Rejeté</Badge>
    }
  }

  const getPriorityBadge = (priority: Dossier['priority']) => {
    switch (priority) {
      case 'HIGH': return <Badge variant="danger">Haute</Badge>
      case 'MEDIUM': return <Badge variant="warning">Moyenne</Badge>
      case 'LOW': return <Badge variant="secondary">Basse</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bureau de Validation KYC</h1>
        <p className="text-slate-500">Examinez et validez les dossiers KYC des clients</p>
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
                <div key={dossier.id} className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-slate-50 ${selectedDossier?.id === dossier.id ? 'border-slate-900 bg-slate-50' : ''}`} onClick={() => setSelectedDossier(dossier)}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dossier.clientName}</span>
                    {getPriorityBadge(dossier.priority)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                    <span>{dossier.id}</span>
                    {getStatusBadge(dossier.status)}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{dossier.documents} documents • {new Date(dossier.submittedAt).toLocaleDateString('fr-FR')}</div>
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
                    <CardDescription>{selectedDossier.id}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {getPriorityBadge(selectedDossier.priority)}
                    {getStatusBadge(selectedDossier.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-sm text-slate-500">Téléphone</p><p className="font-medium">{selectedDossier.clientPhone}</p></div>
                  <div><p className="text-sm text-slate-500">Documents</p><p className="font-medium">{selectedDossier.documents} fichiers</p></div>
                  <div><p className="text-sm text-slate-500">Soumis le</p><p className="font-medium">{new Date(selectedDossier.submittedAt).toLocaleString('fr-FR')}</p></div>
                </div>
                <div className="flex gap-4 border-t pt-6">
                  <Button variant="outline" className="flex-1"><Eye className="mr-2 h-4 w-4" />Voir documents</Button>
                  <Button variant="destructive" className="flex-1"><XCircle className="mr-2 h-4 w-4" />Rejeter</Button>
                  <Button className="flex-1"><CheckCircle className="mr-2 h-4 w-4" />Approuver</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-slate-500">Sélectionnez un dossier pour voir les détails</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
