import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { User, Mail, Shield, Building2 } from 'lucide-react'

export default function ProfilePage() {
  const { user, logout } = useAuth()

  if (!user) return null

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'JEAN': return <Badge variant="default">Validation KYC</Badge>
      case 'THOMAS': return <Badge variant="destructive">Conformité AML</Badge>
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
              <Input value={user.agency || 'Non assigné'} disabled />
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
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={logout}>Se déconnecter</Button>
        </CardContent>
      </Card>
    </div>
  )
}