import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { User, Mail, Shield, Building2, KeyRound, Loader2, CheckCircle } from 'lucide-react'

export default function ProfilePage() {
  const { user, logout, getAuthHeader } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [changeSuccess, setChangeSuccess] = useState(false)

  if (!user) return null

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'JEAN': return <Badge variant="default">Validation KYC</Badge>
      case 'THOMAS': return <Badge variant="danger">Conformité AML</Badge>
      case 'SYLVIE': return <Badge variant="success">Command Center</Badge>
      case 'ADMIN_IT': return <Badge variant="secondary">Administration</Badge>
      default: return <Badge>{role}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon Profil</h1>
        <p className="text-slate-500">Gérez vos informations personnelles</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>Vos données de compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nom</label>
              <Input value={user.name} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <Input value={user.email} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Rôle</label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                {getRoleBadge(user.role)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informations agence
            </CardTitle>
            <CardDescription>Votre affectation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Agence</label>
              <Input value={user.agencyId || 'Non assigné'} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">ID Utilisateur</label>
              <Input value={user.id} disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Changer le mot de passe</CardTitle>
          <CardDescription>Modifiez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {changeSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />Mot de passe modifié avec succès
            </div>
          )}
          {changeError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{changeError}</div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Mot de passe actuel</label>
            <Input type="password" value={currentPassword} onChange={e => { setCurrentPassword(e.target.value); setChangeSuccess(false); setChangeError('') }} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
            <Input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setChangeSuccess(false); setChangeError('') }} placeholder="Min. 8 caractères" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Confirmer le nouveau mot de passe</label>
            <Input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setChangeSuccess(false); setChangeError('') }} />
          </div>
          <Button
            onClick={async () => {
              setChangeError(''); setChangeSuccess(false)
              if (newPassword !== confirmPassword) { setChangeError('Les mots de passe ne correspondent pas'); return }
              if (newPassword.length < 8) { setChangeError('Le mot de passe doit contenir au moins 8 caractères'); return }
              setChanging(true)
              try {
                const res = await fetch('/api/v1/auth/agent/password-change', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                  body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
                })
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}))
                  throw new Error(data.detail || 'Erreur lors du changement')
                }
                setChangeSuccess(true)
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
              } catch (err: any) { setChangeError(err.message) }
              finally { setChanging(false) }
            }}
            disabled={changing || !currentPassword || !newPassword || !confirmPassword}
          >
            {changing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={logout}>Se déconnecter</Button>
        </CardContent>
      </Card>
    </div>
  )
}
