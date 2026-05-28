import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Filter,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet } from '@/services/api-client'

type Filters = {
  date_from: string
  date_to: string
  agency_id: string
  channel: string
  doc_type: string
  agent_id: string
}

const emptyFilters: Filters = {
  date_from: '',
  date_to: '',
  agency_id: '',
  channel: '',
  doc_type: '',
  agent_id: '',
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim())
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <Icon className="h-7 w-7 flex-shrink-0 text-slate-600" />
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-slate-950">{value ?? 0}</p>
          <p className="text-sm text-slate-500">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">{label}</div>
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters)
  const [data, setData] = useState<any>(null)
  const [technical, setTechnical] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleTabs = useMemo(() => {
    if (user?.role === 'THOMAS') return ['fraud', 'compliance']
    if (user?.role === 'ADMIN_IT') return ['qa', 'technical']
    return ['overview', 'funnel', 'documents', 'fraud', 'compliance', 'marketing', 'qa', 'technical']
  }, [user?.role])

  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0] || 'overview')
  }, [activeTab, visibleTabs])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const query = buildQuery(appliedFilters)
      try {
        const dashboard = await apiGet(`/analytics/dashboard${query}`)
        setData(dashboard)
        if (user?.role === 'SYLVIE' || user?.role === 'ADMIN_IT') {
          try {
            setTechnical(await apiGet(`/analytics/technical${query}`))
          } catch (technicalErr) {
            console.warn('Failed to load technical analytics:', technicalErr)
            setTechnical({
              db: 'n/a',
              redis: 'n/a',
              sentry_proxy: 'n/a',
              environment: 'n/a',
              qa: dashboard?.qa || {},
            })
          }
        }
      } catch (err) {
        console.error('Failed to load analytics:', err)
        setError('Impossible de charger les métriques analytics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [appliedFilters, user?.role])

  if (loading) {
    return (
      <div className="flex h-[360px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>

  const funnel = data?.funnel || []
  const documents = data?.document_performance || {}
  const fraud = data?.fraud_gaps || {}
  const compliance = data?.compliance_kpis || {}
  const marketing = data?.marketing?.channels || []
  const qa = data?.qa || technical?.qa || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Analytics & métriques</h1>
        <p className="text-sm text-slate-500">Données issues du schéma DWH PostgreSQL</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3 xl:grid-cols-6">
          <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          <Input placeholder="Agence ID" value={filters.agency_id} onChange={(e) => setFilters({ ...filters, agency_id: e.target.value })} />
          <Input placeholder="Canal" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })} />
          <Input placeholder="Type document" value={filters.doc_type} onChange={(e) => setFilters({ ...filters, doc_type: e.target.value })} />
          <Button onClick={() => setAppliedFilters(filters)}>
            <Filter className="mr-2 h-4 w-4" />
            Filtrer
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {visibleTabs.includes('overview') && <TabsTrigger value="overview">Vue générale</TabsTrigger>}
          {visibleTabs.includes('funnel') && <TabsTrigger value="funnel">Funnel adoption</TabsTrigger>}
          {visibleTabs.includes('documents') && <TabsTrigger value="documents">Documents & OCR</TabsTrigger>}
          {visibleTabs.includes('fraud') && <TabsTrigger value="fraud">Fraude & AML</TabsTrigger>}
          {visibleTabs.includes('compliance') && <TabsTrigger value="compliance">Compliance</TabsTrigger>}
          {visibleTabs.includes('marketing') && <TabsTrigger value="marketing">Marketing</TabsTrigger>}
          {visibleTabs.includes('qa') && <TabsTrigger value="qa">QA & opérations</TabsTrigger>}
          {visibleTabs.includes('technical') && <TabsTrigger value="technical">Technique</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Taux de conversion" value={data?.conversion_metrics?.conversion_rate || '0%'} icon={TrendingUp} />
            <MetricCard title="Taux d'abandon" value={data?.conversion_metrics?.abandon_rate || '0%'} icon={AlertTriangle} />
            <MetricCard title="Dossiers créés" value={data?.conversion_metrics?.total_onboardings || 0} icon={FileText} />
            <MetricCard title="SLA validation" value={data?.sla?.avg_validation_time || '0m'} icon={Clock} />
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader><CardTitle>Funnel adoption</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {funnel.length === 0 && <EmptyState label="Aucune donnée de funnel disponible dans le DWH." />}
              {funnel.map((item: any) => (
                <div key={item.step} className="grid grid-cols-[150px_1fr_90px] items-center gap-3 text-sm">
                  <span>{item.step}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-slate-700" style={{ width: `${Math.min(item.rate || 0, 100)}%` }} />
                  </div>
                  <span className="text-right font-medium">{item.count} · {item.rate}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Documents traités" value={documents.total_documents || 0} icon={FileText} />
          <MetricCard title="Vitesse OCR moyenne" value={documents.avg_ocr_speed || '0ms'} icon={Clock} />
          <MetricCard title="Confiance OCR moyenne" value={documents.avg_ocr_confidence || '0%'} icon={CheckCircle} />
          <MetricCard title="Correction manuelle" value={documents.manual_correction_rate || '0%'} icon={Wrench} />
        </TabsContent>

        <TabsContent value="fraud" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Échecs liveness" value={fraud.liveness_failures || 0} icon={ShieldAlert} />
          <MetricCard title="Face match failed" value={fraud.face_match_failures || 0} icon={AlertTriangle} />
          <MetricCard title="Conflits NIU" value={fraud.niu_conflicts || 0} icon={BarChart3} />
          <MetricCard title="Fraudes suspectées" value={fraud.fraud_suspects || 0} icon={ShieldAlert} />
        </TabsContent>

        <TabsContent value="compliance" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Alertes AML ouvertes" value={compliance.open_alerts || 0} icon={ShieldAlert} />
          <MetricCard title="Alertes confirmées" value={compliance.confirmed_alerts || 0} icon={AlertTriangle} />
          <MetricCard title="Couverture consentement" value={compliance.consent_coverage_rate || '0%'} icon={ShieldCheck} />
          <MetricCard title="Taux screening PEP" value={compliance.pep_sanctions_check_rate || '0%'} icon={CheckCircle} />
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader><CardTitle>Adoption par canal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {marketing.length === 0 && <EmptyState label="Aucun canal mesuré." />}
              {marketing.map((channel: any) => (
                <div key={channel.channel} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-medium">{channel.channel}</span>
                  <span>{channel.sessions} sessions</span>
                  <Badge>{channel.conversion_rate}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qa" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="OCR failed" value={qa.ocr_failed || 0} icon={AlertTriangle} />
          <MetricCard title="OCR partial" value={qa.ocr_partial || 0} icon={FileText} />
          <MetricCard title="Erreurs auditables" value={qa.audit_error_events || 0} icon={BarChart3} />
          <MetricCard title="Jobs Celery failed" value={qa.celery_failed_jobs || 0} icon={Wrench} />
        </TabsContent>

        <TabsContent value="technical" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Base de données" value={technical?.db || 'n/a'} icon={Database} />
          <MetricCard title="Redis" value={technical?.redis || 'n/a'} icon={Database} />
          <MetricCard title="Sentry proxy" value={technical?.sentry_proxy || 'n/a'} icon={ShieldCheck} />
          <MetricCard title="Environnement" value={technical?.environment || 'n/a'} icon={Wrench} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
