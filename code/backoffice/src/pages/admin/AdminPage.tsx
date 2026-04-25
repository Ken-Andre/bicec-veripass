import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Users, Settings, Plus, RefreshCw, KeyRound, Trash2, Pencil, Loader2, AlertCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AgentInfo {
  id: string
  name: string
  email: string
  role: string
  agency_id: string | null
  is_available: boolean
  active_dossier_count: number
  last_activity_at: string | null
}

const API_BASE = '/api/v1'

const ROLE_LABELS: Record<string, string> = {
  JEAN: 'Validation KYC',
  THOMAS: 'Conformité AML',
  SYLVIE: 'Command Center',
  ADMIN_IT: 'Administration',
}

const ROLE_VARIANTS: Record<string, 'default' | 'danger' | 'success' | 'secondary'> = {
  JEAN: 'default',
  THOMAS: 'danger',
  SYLVIE: 'success',
  ADMIN_IT: 'secondary',
}

const ROLE_OPTIONS = ['JEAN', 'THOMAS', 'SYLVIE', 'ADMIN_IT'] as const

export default function AdminPage() {
  const { getAuthHeader } = useAuth()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create agent modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'JEAN' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<AgentInfo | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  // Edit agent modal state
  const [editTarget, setEditTarget] = useState<AgentInfo | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', is_available: true })
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState('')

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/agents`, { headers: { ...getAuthHeader() } })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAgents(data.items ?? data ?? [])
    } catch {
      setError('Impossible de charger les agents')
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const handleCreate = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch(`${API_BASE}/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Erreur')
      }
      setShowCreate(false)
      setCreateForm({ name: '', email: '', password: '', role: 'JEAN' })
      await fetchAgents()
    } catch (e: any) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    setResetting(true)
    setResetError('')
    try {
      const res = await fetch(`${API_BASE}/admin/agents/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ new_password: newPassword }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Erreur')
      }
      setResetTarget(null)
      setNewPassword('')
    } catch (e: any) {
      setResetError(e.message)
    } finally {
      setResetting(false)
    }
  }

  const handleEdit = async () => {
    if (!editTarget) return
    setEditing(true)
    setEditError('')
    try {
      const res = await fetch(`${API_BASE}/admin/agents/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Erreur')
      }
      setEditTarget(null)
      await fetchAgents()
    } catch (e: any) {
      setEditError(e.message)
    } finally {
      setEditing(false)
    }
  }

  const handleDeactivate = async (agent: AgentInfo) => {
    if (!confirm(`Désactiver l'agent ${agent.name} ?`)) return
    try {
      const res = await fetch(`${API_BASE}/admin/agents/${agent.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      await fetchAgents()
    } catch {
      setError('Impossible de désactiver cet agent')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-500">Gérez les agents et configuration système</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAgents}>
            <RefreshCw className="mr-2 h-4 w-4" />Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />Nouvel agent
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {/* Agents list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />Agents
          </CardTitle>
          <CardDescription>Comptes agents du back-office</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : agents.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Aucun agent trouvé</p>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{agent.name}</p>
                      <Badge variant={agent.is_available ? 'success' : 'secondary'}>
                        {agent.is_available ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-slate-500">{agent.email}</p>
                    {agent.last_activity_at && (
                      <p className="text-xs text-slate-400">
                        Dernière activité : {new Date(agent.last_activity_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ROLE_VARIANTS[agent.role] ?? 'secondary'}>
                      {ROLE_LABELS[agent.role] ?? agent.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditTarget(agent)
                        setEditForm({ name: agent.name, email: agent.email, role: agent.role, is_available: agent.is_available })
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResetTarget(agent)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    {agent.is_available && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeactivate(agent)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System configuration card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />Configuration système
          </CardTitle>
          <CardDescription>Paramètres globaux de l'application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Seuil OCR</h3>
              <p className="text-sm text-slate-500">Confiance minimale pour validation automatique</p>
              <p className="mt-1 text-lg font-semibold text-blue-600">0.85</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Tentatives connexion</h3>
              <p className="text-sm text-slate-500">Max avant verrouillage du compte</p>
              <p className="mt-1 text-lg font-semibold text-blue-600">5</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Durée verrouillage</h3>
              <p className="text-sm text-slate-500">Durée du verrou après échecs</p>
              <p className="mt-1 text-lg font-semibold text-blue-600">15 min</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium">Expiration OTP</h3>
              <p className="text-sm text-slate-500">Durée de validité du code OTP</p>
              <p className="mt-1 text-lg font-semibold text-blue-600">5 min</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create agent modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nouvel agent</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {createError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{createError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Nom</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="jean@bicec.cm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Mot de passe</label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Min. 8 caractères"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Rôle</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={creating || !createForm.name || !createForm.email || !createForm.password}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit agent modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Modifier — {editTarget.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {editError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{editError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Nom</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Rôle</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-available"
                  checked={editForm.is_available}
                  onChange={(e) => setEditForm({ ...editForm, is_available: e.target.checked })}
                />
                <label htmlFor="edit-available" className="text-sm font-medium text-slate-700">
                  Agent disponible
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
                <Button onClick={handleEdit} disabled={editing}>
                  {editing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Réinitialiser mot de passe — {resetTarget.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setResetTarget(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {resetError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{resetError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
                <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}>
                  {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Réinitialiser
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
