import { useEffect, useState } from 'react'
import { FileText, Loader2, Plus, RefreshCw, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { apiGet, apiPatch, apiPost } from '@/services/api-client'

type LegalDocumentKey = 'cgu' | 'privacy' | 'data_processing' | 'biometric'
type LegalStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

interface LegalDocument {
  id: string
  document_key: LegalDocumentKey
  locale: 'fr' | 'en'
  version: string
  title: string
  content: string
  content_hash: string
  status: LegalStatus
  effective_at?: string | null
  published_at?: string | null
}

interface LegalDocumentCreate {
  document_key: LegalDocumentKey
  locale: 'fr' | 'en'
  version: string
  title: string
  content: string
  status: LegalStatus
}

const INITIAL_FORM: LegalDocumentCreate = {
  document_key: 'cgu',
  locale: 'fr',
  version: '1.0.1',
  title: '',
  content: '',
  status: 'DRAFT',
}

const KEY_LABELS: Record<LegalDocumentKey, string> = {
  cgu: 'CGU',
  privacy: 'Confidentialite',
  data_processing: 'Donnees personnelles',
  biometric: 'Biometrie',
}

function statusVariant(status: LegalStatus) {
  if (status === 'PUBLISHED') return 'success' as const
  if (status === 'ARCHIVED') return 'secondary' as const
  return 'warning' as const
}

export default function LegalDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([])
  const [form, setForm] = useState<LegalDocumentCreate>(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadDocuments = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<LegalDocument[]>('/legal/admin/documents')
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const createDocument = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.version.trim()) {
      setError('Titre, version et contenu sont obligatoires.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiPost('/legal/admin/documents', form)
      setForm(INITIAL_FORM)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation impossible.')
    } finally {
      setSaving(false)
    }
  }

  const publishDocument = async (document: LegalDocument) => {
    setSaving(true)
    setError('')
    try {
      await apiPatch(`/legal/admin/documents/${document.id}`, { status: 'PUBLISHED' })
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Documents legaux</h1>
          <p className="text-slate-500">
            Publiez les CGU, politiques de confidentialite et consentements sans redemarrer l'application.
          </p>
        </div>
        <Button variant="outline" onClick={loadDocuments} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualiser
        </Button>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle version
          </CardTitle>
          <CardDescription>
            Une version publiee devient la source de verite visible par les clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">
              Type
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={form.document_key}
                onChange={(event) => setForm({ ...form, document_key: event.target.value as LegalDocumentKey })}
              >
                {Object.entries(KEY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Langue
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={form.locale}
                onChange={(event) => setForm({ ...form, locale: event.target.value as 'fr' | 'en' })}
              >
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Version
              <Input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Statut
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as LegalStatus })}
              >
                <option value="DRAFT">Brouillon</option>
                <option value="PUBLISHED">Publier maintenant</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Titre
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Contenu
            <Textarea
              className="min-h-[180px]"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
          </label>
          <Button onClick={createDocument} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Versions existantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun document legal.</p>
          ) : (
            documents.map((document) => (
              <div key={document.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{KEY_LABELS[document.document_key]}</Badge>
                      <Badge variant="secondary">{document.locale.toUpperCase()}</Badge>
                      <Badge variant={statusVariant(document.status)}>{document.status}</Badge>
                      <span className="text-xs text-slate-500">v{document.version}</span>
                    </div>
                    <h2 className="mt-2 font-semibold text-slate-900">{document.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">Hash: {document.content_hash.slice(0, 16)}...</p>
                  </div>
                  {document.status === 'DRAFT' && (
                    <Button variant="outline" size="sm" onClick={() => publishDocument(document)} disabled={saving}>
                      Publier
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
