import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileText,
  Filter,
  Loader2,
  Save,
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
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/contexts/AuthContext'
import { apiGet, apiGetBlob, apiPost, apiPut } from '@/services/api-client'

type Filters = {
  date_from: string
  date_to: string
  agency_id: string
  channel: string
  doc_type: string
  agent_id: string
}

type BaselineForm = {
  id: string
  period_start: string
  period_end: string
  agency_id: string
  monthly_kyc_volume: string
  current_avg_days_to_validate: string
  current_branch_minutes_per_dossier: string
  current_backoffice_minutes_per_dossier: string
  current_incomplete_rate: string
  current_complement_rate: string
  current_abandonment_rate: string
  hourly_staff_cost_xaf: string
  avg_customer_12m_value_xaf: string
  audit_requests_per_period: string
  current_audit_assembly_hours: string
  veripass_audit_export_hours: string
  average_rework_cost_xaf: string
  current_aml_sensitive_case_rate: string
  pilot_setup_cost_xaf: string
  pilot_monthly_run_cost_xaf: string
  pilot_duration_months: string
  source_note: string
}

const emptyFilters: Filters = {
  date_from: '',
  date_to: '',
  agency_id: '',
  channel: '',
  doc_type: '',
  agent_id: '',
}

const emptyBaselineForm: BaselineForm = {
  id: '',
  period_start: '',
  period_end: '',
  agency_id: '',
  monthly_kyc_volume: '',
  current_avg_days_to_validate: '',
  current_branch_minutes_per_dossier: '',
  current_backoffice_minutes_per_dossier: '',
  current_incomplete_rate: '',
  current_complement_rate: '',
  current_abandonment_rate: '',
  hourly_staff_cost_xaf: '',
  avg_customer_12m_value_xaf: '',
  audit_requests_per_period: '',
  current_audit_assembly_hours: '',
  veripass_audit_export_hours: '',
  average_rework_cost_xaf: '',
  current_aml_sensitive_case_rate: '',
  pilot_setup_cost_xaf: '',
  pilot_monthly_run_cost_xaf: '',
  pilot_duration_months: '',
  source_note: '',
}

const baselineNumberFields: Array<keyof BaselineForm> = [
  'monthly_kyc_volume',
  'current_avg_days_to_validate',
  'current_branch_minutes_per_dossier',
  'current_backoffice_minutes_per_dossier',
  'current_incomplete_rate',
  'current_complement_rate',
  'current_abandonment_rate',
  'hourly_staff_cost_xaf',
  'avg_customer_12m_value_xaf',
  'audit_requests_per_period',
  'current_audit_assembly_hours',
  'veripass_audit_export_hours',
  'average_rework_cost_xaf',
  'current_aml_sensitive_case_rate',
  'pilot_setup_cost_xaf',
  'pilot_monthly_run_cost_xaf',
  'pilot_duration_months',
]

const integerBaselineFields = new Set<keyof BaselineForm>([
  'monthly_kyc_volume',
  'audit_requests_per_period',
  'pilot_duration_months',
])

const baselineFieldLabels: Array<{ key: keyof BaselineForm; label: string; placeholder?: string }> = [
  { key: 'monthly_kyc_volume', label: 'Volume KYC mensuel', placeholder: '1200' },
  { key: 'current_avg_days_to_validate', label: 'Delai actuel validation (jours)', placeholder: '3.5' },
  { key: 'current_branch_minutes_per_dossier', label: 'Minutes agence actuelles', placeholder: '18' },
  { key: 'current_backoffice_minutes_per_dossier', label: 'Minutes backoffice actuelles', placeholder: '22' },
  { key: 'current_incomplete_rate', label: 'Taux incomplets actuel (0..1)', placeholder: '0.18' },
  { key: 'current_complement_rate', label: 'Taux complements actuel (0..1)', placeholder: '0.14' },
  { key: 'current_abandonment_rate', label: 'Taux abandon actuel (0..1)', placeholder: '0.10' },
  { key: 'hourly_staff_cost_xaf', label: 'Cout horaire staff XAF', placeholder: '7500' },
  { key: 'avg_customer_12m_value_xaf', label: 'Valeur client 12 mois XAF', placeholder: '45000' },
  { key: 'audit_requests_per_period', label: 'Demandes audit / periode', placeholder: '4' },
  { key: 'current_audit_assembly_hours', label: 'Heures audit actuelles', placeholder: '6' },
  { key: 'veripass_audit_export_hours', label: 'Heures export VeriPass', placeholder: '0.25' },
  { key: 'average_rework_cost_xaf', label: 'Cout reprise dossier XAF', placeholder: '5000' },
  { key: 'current_aml_sensitive_case_rate', label: 'Taux dossiers AML sensibles (0..1)', placeholder: '0.03' },
  { key: 'pilot_setup_cost_xaf', label: 'Cout setup pilote XAF', placeholder: '2500000' },
  { key: 'pilot_monthly_run_cost_xaf', label: 'Cout run mensuel XAF', placeholder: '750000' },
  { key: 'pilot_duration_months', label: 'Duree pilote (mois)', placeholder: '3' },
]

function buildQuery(filters: Filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim())
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

function buildExportQuery(filters: Filters, format: 'html' | 'json') {
  const params = new URLSearchParams(buildQuery(filters).replace(/^\?/, ''))
  params.set('format', format)
  return `?${params.toString()}`
}

function formValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value)
}

function formFromBaseline(baseline: any): BaselineForm {
  if (!baseline) return emptyBaselineForm
  return {
    ...emptyBaselineForm,
    ...Object.fromEntries(Object.keys(emptyBaselineForm).map((key) => [key, formValue(baseline[key])])),
  } as BaselineForm
}

function numberOrNull(value: string, integer = false) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return integer ? Math.trunc(parsed) : parsed
}

function baselinePayload(form: BaselineForm) {
  const payload: Record<string, any> = {
    period_start: form.period_start,
    period_end: form.period_end,
    agency_id: form.agency_id.trim() || null,
    source_note: form.source_note.trim() || null,
  }
  if (form.id) payload.id = form.id
  baselineNumberFields.forEach((key) => {
    payload[key] = numberOrNull(form[key], integerBaselineFields.has(key))
  })
  return payload
}

function metricDisplay(metric: any, fallback = '0') {
  return metric?.display ?? fallback
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
  const [businessCase, setBusinessCase] = useState<any>(null)
  const [baselineForm, setBaselineForm] = useState<BaselineForm>(emptyBaselineForm)
  const [baselineSaving, setBaselineSaving] = useState(false)
  const [baselineError, setBaselineError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canUseBusiness = user?.role === 'SYLVIE' || user?.role === 'ADMIN_IT'

  const visibleTabs = useMemo(() => {
    if (user?.role === 'THOMAS') return ['fraud', 'compliance']
    if (user?.role === 'ADMIN_IT') return ['business', 'qa', 'technical']
    return ['overview', 'business', 'funnel', 'documents', 'fraud', 'compliance', 'marketing', 'qa', 'technical']
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
        if (canUseBusiness) {
          const business = await apiGet(`/analytics/business-case${query}`)
          setBusinessCase(business)
          setBaselineForm(formFromBaseline(business?.baseline))
        } else {
          setBusinessCase(null)
        }
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
        setError('Impossible de charger les metriques analytics')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [appliedFilters, canUseBusiness, user?.role])

  const saveBaseline = async () => {
    setBaselineSaving(true)
    setBaselineError(null)
    try {
      const payload = baselinePayload(baselineForm)
      const saved = baselineForm.id
        ? await apiPut('/analytics/business-baseline', payload)
        : await apiPost('/analytics/business-baseline', payload)
      setBaselineForm(formFromBaseline(saved))
      setBusinessCase(await apiGet(`/analytics/business-case${buildQuery(appliedFilters)}`))
    } catch (err: any) {
      setBaselineError(err?.detail || 'Impossible de sauvegarder la baseline ROI')
    } finally {
      setBaselineSaving(false)
    }
  }

  const exportBusinessCase = async (format: 'html' | 'json') => {
    setExporting(true)
    setBaselineError(null)
    try {
      const { blob, filename } = await apiGetBlob(`/analytics/business-case/export${buildExportQuery(appliedFilters, format)}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || (format === 'json' ? 'veripass-business-case.json' : 'veripass-business-case.html')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err: any) {
      setBaselineError(err?.detail || "Impossible d'exporter le business case")
    } finally {
      setExporting(false)
    }
  }

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
  const network = businessCase?.network_quality || {}
  const operations = businessCase?.operations || {}
  const finance = businessCase?.finance || {}
  const direction = businessCase?.direction || {}
  const businessCompliance = businessCase?.compliance || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Analytics & metriques</h1>
        <p className="text-sm text-slate-500">Donnees issues du schema DWH PostgreSQL</p>
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
          {visibleTabs.includes('overview') && <TabsTrigger value="overview">Vue generale</TabsTrigger>}
          {visibleTabs.includes('business') && <TabsTrigger value="business">Pilotage & ROI</TabsTrigger>}
          {visibleTabs.includes('funnel') && <TabsTrigger value="funnel">Funnel adoption</TabsTrigger>}
          {visibleTabs.includes('documents') && <TabsTrigger value="documents">Documents & OCR</TabsTrigger>}
          {visibleTabs.includes('fraud') && <TabsTrigger value="fraud">Fraude & AML</TabsTrigger>}
          {visibleTabs.includes('compliance') && <TabsTrigger value="compliance">Compliance</TabsTrigger>}
          {visibleTabs.includes('marketing') && <TabsTrigger value="marketing">Marketing</TabsTrigger>}
          {visibleTabs.includes('qa') && <TabsTrigger value="qa">QA & operations</TabsTrigger>}
          {visibleTabs.includes('technical') && <TabsTrigger value="technical">Technique</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Taux de conversion" value={data?.conversion_metrics?.conversion_rate || '0%'} icon={TrendingUp} />
            <MetricCard title="Taux d'abandon" value={data?.conversion_metrics?.abandon_rate || '0%'} icon={AlertTriangle} />
            <MetricCard title="Dossiers crees" value={data?.conversion_metrics?.total_onboardings || 0} icon={FileText} />
            <MetricCard title="SLA validation" value={data?.sla?.avg_validation_time || '0m'} icon={Clock} />
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          {businessCase?.baseline_required && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Baseline requise pour calculer les couts, gains et ROI. Les metriques VeriPass observees restent disponibles.
            </div>
          )}
          {baselineError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{baselineError}</div>}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Baseline BICEC validee</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={exporting} onClick={() => exportBusinessCase('json')}>
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
                <Button variant="outline" disabled={exporting} onClick={() => exportBusinessCase('html')}>
                  <Download className="mr-2 h-4 w-4" />
                  HTML
                </Button>
                <Button onClick={saveBaseline} disabled={baselineSaving || !baselineForm.period_start || !baselineForm.period_end}>
                  {baselineSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Enregistrer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Debut periode</p>
                  <Input type="date" value={baselineForm.period_start} onChange={(e) => setBaselineForm({ ...baselineForm, period_start: e.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Fin periode</p>
                  <Input type="date" value={baselineForm.period_end} onChange={(e) => setBaselineForm({ ...baselineForm, period_end: e.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Agence ID optionnel</p>
                  <Input value={baselineForm.agency_id} onChange={(e) => setBaselineForm({ ...baselineForm, agency_id: e.target.value })} />
                </div>
                {baselineFieldLabels.map((field) => (
                  <div key={field.key}>
                    <p className="mb-1 text-xs font-medium text-slate-500">{field.label}</p>
                    <Input
                      type="number"
                      step="any"
                      placeholder={field.placeholder}
                      value={baselineForm[field.key]}
                      onChange={(e) => setBaselineForm({ ...baselineForm, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Source / validation</p>
                <Textarea
                  className="min-h-[84px]"
                  value={baselineForm.source_note}
                  onChange={(e) => setBaselineForm({ ...baselineForm, source_note: e.target.value })}
                  placeholder="Ex: chiffres valides par BICEC pour le pilote Douala, periode T3."
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="First-time-right" value={metricDisplay(network.first_time_right_rate, '0%')} icon={CheckCircle} />
            <MetricCard title="Demande complement" value={metricDisplay(network.complement_request_rate, '0%')} icon={FileText} />
            <MetricCard title="Re-soumission" value={metricDisplay(network.resubmission_rate, '0%')} icon={TrendingUp} />
            <MetricCard title="Correction OCR" value={metricDisplay(network.ocr_correction_rate, '0%')} icon={Wrench} />
            <MetricCard title="Start -> submit" value={metricDisplay(network.start_to_submit_delay, '0m')} icon={Clock} />
            <MetricCard title="Submit -> decision" value={metricDisplay(operations.submit_to_decision_delay, '0m')} icon={Clock} />
            <MetricCard title="Revue agent moyenne" value={metricDisplay(operations.average_agent_review_duration, '0m')} icon={Calculator} />
            <MetricCard title="SLA respecte" value={metricDisplay(operations.sla_respected_rate, '0%')} icon={ShieldCheck} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Cout actuel / dossier" value={metricDisplay(finance.current_cost_per_dossier, 'Baseline requise')} icon={Calculator} />
            <MetricCard title="Cout VeriPass / dossier" value={metricDisplay(finance.veripass_cost_per_dossier, 'Baseline requise')} icon={Calculator} />
            <MetricCard title="Economies mensuelles" value={metricDisplay(finance.operational_savings_monthly, 'Baseline requise')} icon={TrendingUp} />
            <MetricCard title="ROI pilote" value={metricDisplay(finance.roi_percent, 'Baseline requise')} icon={BarChart3} />
            <MetricCard title="Abandon pilote" value={metricDisplay(direction.pilot_abandonment_rate, '0%')} icon={AlertTriangle} />
            <MetricCard title="Conversion start -> approved" value={metricDisplay(direction.start_to_approved_conversion_rate, '0%')} icon={CheckCircle} />
            <MetricCard title="Gain commercial" value={metricDisplay(direction.estimated_commercial_value, 'Baseline requise')} icon={TrendingUp} />
            <MetricCard title="Gain conformite" value={metricDisplay(finance.compliance_gain_monthly, 'Baseline requise')} icon={ShieldCheck} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Alertes AML" value={metricDisplay(businessCompliance.aml_alert_rate, '0%')} icon={ShieldAlert} />
            <MetricCard title="Nombre alertes AML" value={metricDisplay(businessCompliance.aml_alert_count, '0')} icon={AlertTriangle} />
            <MetricCard title="Bloques risque ouvert" value={metricDisplay(businessCompliance.risk_blocked_open_count, '0')} icon={ShieldAlert} />
            <MetricCard title="Temps audit evite" value={metricDisplay(businessCompliance.audit_export_time_saved_hours, 'Baseline requise')} icon={FileText} />
          </div>

          <Card>
            <CardHeader><CardTitle>Formules de calcul</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(businessCase?.formulas || []).map((item: any) => (
                <div key={item.metric} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[180px_1fr_220px]">
                  <span className="font-medium">{item.metric}</span>
                  <span className="text-slate-600">{item.formula}</span>
                  <Badge className="bg-slate-100 text-slate-700">{item.source}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader><CardTitle>Funnel adoption</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {funnel.length === 0 && <EmptyState label="Aucune donnee de funnel disponible dans le DWH." />}
              {funnel.map((item: any) => (
                <div key={item.step} className="grid grid-cols-[150px_1fr_90px] items-center gap-3 text-sm">
                  <span>{item.step}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-slate-700" style={{ width: `${Math.min(item.rate || 0, 100)}%` }} />
                  </div>
                  <span className="text-right font-medium">{item.count} - {item.rate}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Documents traites" value={documents.total_documents || 0} icon={FileText} />
          <MetricCard title="Vitesse OCR moyenne" value={documents.avg_ocr_speed || '0ms'} icon={Clock} />
          <MetricCard title="Confiance OCR moyenne" value={documents.avg_ocr_confidence || '0%'} icon={CheckCircle} />
          <MetricCard title="Correction manuelle" value={documents.manual_correction_rate || '0%'} icon={Wrench} />
        </TabsContent>

        <TabsContent value="fraud" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Echecs liveness" value={fraud.liveness_failures || 0} icon={ShieldAlert} />
          <MetricCard title="Face match failed" value={fraud.face_match_failures || 0} icon={AlertTriangle} />
          <MetricCard title="Conflits NIU" value={fraud.niu_conflicts || 0} icon={BarChart3} />
          <MetricCard title="Fraudes suspectees" value={fraud.fraud_suspects || 0} icon={ShieldAlert} />
        </TabsContent>

        <TabsContent value="compliance" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Alertes AML ouvertes" value={compliance.open_alerts || 0} icon={ShieldAlert} />
          <MetricCard title="Alertes confirmees" value={compliance.confirmed_alerts || 0} icon={AlertTriangle} />
          <MetricCard title="Couverture consentement" value={compliance.consent_coverage_rate || '0%'} icon={ShieldCheck} />
          <MetricCard title="Taux screening PEP" value={compliance.pep_sanctions_check_rate || '0%'} icon={CheckCircle} />
        </TabsContent>

        <TabsContent value="marketing">
          <Card>
            <CardHeader><CardTitle>Adoption par canal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {marketing.length === 0 && <EmptyState label="Aucun canal mesure." />}
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
          <MetricCard title="Base de donnees" value={technical?.db || 'n/a'} icon={Database} />
          <MetricCard title="Redis" value={technical?.redis || 'n/a'} icon={Database} />
          <MetricCard title="Sentry proxy" value={technical?.sentry_proxy || 'n/a'} icon={ShieldCheck} />
          <MetricCard title="Environnement" value={technical?.environment || 'n/a'} icon={Wrench} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
