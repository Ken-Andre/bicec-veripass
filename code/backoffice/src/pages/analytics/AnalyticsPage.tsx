import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet } from '@/services/api-client'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const stats = await apiGet('/analytics/dashboard')
        setData(stats)
      } catch (err: any) {
        console.error('Failed to load analytics dashboard:', err)
        setError('Impossible de charger les statistiques')
      } finally {
        setLoading(false)
      }
    }
    load()
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

  const isThomas = user?.role === 'THOMAS'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics & Métriques</h1>
        <p className="text-slate-500">
          Tableau de bord décisionnel personnalisé • Rôle : {user?.role}
        </p>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isThomas ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <ShieldAlert className="h-8 w-8 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.summary?.find((s: any) => s.name.includes('AML'))?.value || '0'}</p>
                    <p className="text-sm text-slate-500">Alertes AML en cours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <BarChart3 className="h-8 w-8 text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.summary?.find((s: any) => s.name.includes('Conflits'))?.value || '0'}</p>
                    <p className="text-sm text-slate-500">Conflits NIU détectés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <ShieldCheck className="h-8 w-8 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.summary?.find((s: any) => s.name.includes('classés'))?.value || '0'}</p>
                    <p className="text-sm text-slate-500">Faux positifs écartés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.summary?.find((s: any) => s.name.includes('confirmées'))?.value || '0'}</p>
                    <p className="text-sm text-slate-500">Alertes confirmées</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <TrendingUp className="h-8 w-8 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.conversion_metrics?.conversion_rate || '0%'}</p>
                    <p className="text-sm text-slate-500">Taux de conversion</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <TrendingDown className="h-8 w-8 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.conversion_metrics?.abandon_rate || '0%'}</p>
                    <p className="text-sm text-slate-500">Taux d'abandon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.conversion_metrics?.total_onboardings || '0'}</p>
                    <p className="text-sm text-slate-500">Dossiers créés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Clock className="h-8 w-8 text-purple-500 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{data?.sla?.avg_validation_time || '1.5h'}</p>
                    <p className="text-sm text-slate-500">Délai moyen de validation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Advanced Performance & Gaps Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compliance and Fraud Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" /> Sécurité et Fraude
            </CardTitle>
            <CardDescription>Indicateurs de robustesse et détection d'identité</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Échecs Liveness capturés</span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                {data?.fraud_gaps?.liveness_failures || 0} tentatives suspectes
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Cas confirmés de fraude</span>
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                {data?.fraud_gaps?.fraud_suspects || 0} suspects
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Conflits d'identité (NIU)</span>
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                {data?.fraud_gaps?.niu_conflicts || 0} doublons
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score Biométrique Moyen</span>
              <span className="text-sm font-bold text-green-600">
                {data?.fraud_gaps?.avg_biometric_score || '96.4%'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Operations & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" /> Support et Opérations Clients
            </CardTitle>
            <CardDescription>Indicateurs d'assistance active et gestion de cartes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Fils de discussion de support actifs</span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {data?.customer_operations?.active_support_threads || 0} ouverts
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Demandes de réinitialisation Passcode</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                {data?.customer_operations?.passcode_resets || 0} requêtes
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Demandes de Cartes (Visa/Mastercard)
              </span>
              <span className="text-sm font-bold text-slate-900">
                {data?.customer_operations?.visa_mastercard_delivery || 0} cartes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Operational Funnel & Document Extracts (Omitted for Thomas) */}
        {!isThomas && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" /> Funnel de conversion
                </CardTitle>
                <CardDescription>Étapes réelles du parcours client</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.funnel?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-32 text-sm">{item.step}</div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${item.rate}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-medium">{item.count}</div>
                      <div className="w-12 text-right text-sm text-slate-500">{item.rate}%</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" /> Performance OCR & Documents
                </CardTitle>
                <CardDescription>Vitesse d'extraction et taux de complétion manuelle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-medium">Taux de correction manuelle</span>
                  <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                    {data?.document_performance?.manual_correction_rate || '5%'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-medium">Confiance Moyenne de l'OCR</span>
                  <span className="text-sm font-bold text-green-600">
                    {data?.document_performance?.avg_ocr_confidence || '88%'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-medium">Vitesse moyenne d'extraction</span>
                  <span className="text-sm font-bold text-slate-700">
                    {data?.document_performance?.avg_ocr_speed || '1.8s'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total documents extraits</span>
                  <span className="text-sm font-bold text-slate-900">
                    {data?.document_performance?.cni_extracted_count || 0} dossiers
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" /> Charge & Efficacité des Agents
                </CardTitle>
                <CardDescription>Statut opérationnel en temps réel par validateur</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data?.agent_performance?.map((agent: any, index: number) => (
                    <div key={index} className="rounded-lg border p-4 bg-slate-50/50">
                      <p className="font-semibold text-slate-950">{agent.name}</p>
                      <p className="text-sm text-slate-500 mb-2">Rôle : {agent.role}</p>
                      <div className="flex justify-between text-xs text-slate-500 border-t pt-2 mt-2">
                        <span>Charge : {agent.dossiers} en attente</span>
                        <span>Traités : {agent.completed}</span>
                      </div>
                    </div>
                  ))}
                  {data?.agent_performance?.length === 0 && (
                    <p className="text-sm text-slate-500 col-span-3 text-center py-4">Aucun agent validateur connecté</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}