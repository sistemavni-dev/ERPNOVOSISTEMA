import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card"
import { CheckCircle, XCircle, LogOut, Users, Settings, Database } from "lucide-react"

interface Tenant {
  id: string
  name: string
  document: string
  status: 'pending' | 'active' | 'defaulting' | 'blocked' | 'inactive'
  plan: 'prata' | 'ouro' | null
  created_at: string
}

export default function SuperAdminDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants()
    }
  }, [isAuthenticated])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "admin123") {
      setIsAuthenticated(true)
    } else {
      alert("Senha incorreta!")
    }
  }

  const fetchTenants = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error(error)
    } else {
      setTenants(data || [])
    }
    setLoading(false)
  }

  const updateTenantStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('tenants')
      .update({ status })
      .eq('id', id)
    
    if (error) {
      alert("Erro ao atualizar: " + error.message)
    } else {
      fetchTenants()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2 text-primary">
              <Database className="w-6 h-6" /> NexERP Admin
            </CardTitle>
            <CardDescription>Área restrita. Digite a senha mestra.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent>
              <div className="space-y-2">
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Senha (admin123)"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Entrar</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Database className="w-6 h-6" /> NexERP
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Super Admin Console</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-2">
            <Users className="w-4 h-4" /> Tenants
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Settings className="w-4 h-4" /> Configurações Globais
          </Button>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Sair do Sistema
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Empresas (Tenants)</h1>
            <p className="text-muted-foreground mt-1">Aprove ou bloqueie o acesso das empresas ao ERP.</p>
          </div>
          <Button onClick={fetchTenants}>Atualizar Lista</Button>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>Lista de todas as instâncias do SaaS.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-4 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Empresa</th>
                      <th className="px-4 py-3 font-medium">Plano</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Data Cadastro</th>
                      <th className="px-4 py-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {tenant.name}
                          <div className="text-xs text-muted-foreground font-normal">{tenant.document || 'Sem CNPJ'}</div>
                        </td>
                        <td className="px-4 py-3">
                          {tenant.plan === 'ouro' ? (
                            <span className="font-bold text-yellow-500 uppercase text-xs">Ouro</span>
                          ) : tenant.plan === 'prata' ? (
                            <span className="font-bold text-zinc-400 uppercase text-xs">Prata</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Nenhum</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${tenant.status === 'active' ? 'bg-green-500/10 text-green-500' : ''}
                            ${tenant.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : ''}
                            ${tenant.status === 'blocked' || tenant.status === 'defaulting' ? 'bg-destructive/10 text-destructive' : ''}
                          `}>
                            {tenant.status === 'active' && 'Ativo'}
                            {tenant.status === 'pending' && 'Pendente'}
                            {tenant.status === 'blocked' && 'Bloqueado'}
                            {tenant.status === 'defaulting' && 'Inadimplente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {tenant.status !== 'active' && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                onClick={() => updateTenantStatus(tenant.id, 'active')}>
                                <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                              </Button>
                            )}
                            {tenant.status === 'active' && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive hover:bg-destructive/10"
                                onClick={() => updateTenantStatus(tenant.id, 'blocked')}>
                                <XCircle className="w-3.5 h-3.5" /> Bloquear
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma empresa encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
