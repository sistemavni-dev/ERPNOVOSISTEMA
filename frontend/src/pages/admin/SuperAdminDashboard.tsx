import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card"
import { CheckCircle, XCircle, LogOut, Users, Database, Mail, Lock } from "lucide-react"

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
  const [verifying, setVerifying] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [email, setEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNeedsAuth(true)
        setVerifying(false)
        return
      }

      const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
      if (!isSuperAdmin) {
        navigate('/dashboard')
        return
      }
      setVerifying(false)
    } catch (err) {
      console.error(err)
      setNeedsAuth(true)
      setVerifying(false)
    }
  }

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: authPassword,
    })

    if (error) {
      setAuthError(error.message)
      setAuthLoading(false)
      return
    }

    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
    if (!isSuperAdmin) {
      setAuthError("Acesso negado: este usuário não é um Super Admin.")
      await supabase.auth.signOut()
      setAuthLoading(false)
      return
    }

    setNeedsAuth(false)
    setAuthLoading(false)
  }

  useEffect(() => {
    if (isAuthenticated && !verifying && !needsAuth) {
      fetchTenants()
    }
  }, [isAuthenticated, verifying, needsAuth])

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

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center font-mono">
        Verificando permissões...
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden dark text-foreground">
        {/* Orbes Neon */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse" />

        <Card className="w-full max-w-md bg-glass border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-cyan-400" />
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2 text-white">
              <Database className="w-6 h-6 text-purple-400" /> NexERP Admin
            </CardTitle>
            <CardDescription className="text-zinc-400">Entre com sua conta Super Admin.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSupabaseAuth}>
            <CardContent className="space-y-4">
              {authError && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                  {authError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-400 uppercase">E-mail Administrativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-400 uppercase">Senha da Conta</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    type="password" 
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-8 pt-4 flex flex-col space-y-3">
              <Button type="submit" className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all border-0 shadow-lg shadow-purple-500/25" disabled={authLoading}>
                {authLoading ? "Autenticando..." : "Entrar como Admin"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-zinc-400 hover:text-white" onClick={() => navigate('/login')}>
                Voltar ao Login Principal
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden dark text-foreground">
        {/* Orbes Neon */}
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse" />

        <Card className="w-full max-w-md bg-glass border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-cyan-400" />
          <CardHeader className="pt-8">
            <CardTitle className="text-2xl font-bold flex items-center gap-2 text-white">
              <Database className="w-6 h-6 text-purple-400" /> NexERP Admin
            </CardTitle>
            <CardDescription className="text-zinc-400">Área restrita. Digite a senha mestra.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-400 uppercase">Senha de Acesso</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Senha (admin123)"
                  className="w-full h-11 px-3 rounded-md border border-white/5 bg-slate-900/50 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button type="submit" className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all border-0 shadow-lg shadow-purple-500/25">Entrar no Console</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] flex dark text-foreground relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[180px] pointer-events-none" />

      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-slate-950/40 backdrop-blur-xl flex flex-col z-10">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-purple-400" /> NexERP
          </h2>
          <p className="text-[10px] font-mono text-purple-400/80 uppercase tracking-widest mt-1">Super Admin Console</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-2 bg-white/5 text-white border-0 hover:bg-white/10">
            <Users className="w-4 h-4 text-purple-400" /> Clientes (Tenants)
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5">
          <Button variant="ghost" className="w-full justify-start gap-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Sair do Sistema
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto z-10">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Empresas Parceiras</h1>
            <p className="text-zinc-400 mt-1 text-sm">Gerencie o nível de assinatura e libere o acesso das empresas ao ERP.</p>
          </div>
          <Button onClick={fetchTenants} className="bg-glass hover:bg-white/5 border-white/10 text-white transition-all">Atualizar Lista</Button>
        </div>

        <Card className="bg-glass border border-white/5 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white font-bold">Empresas Cadastradas</CardTitle>
            <CardDescription className="text-zinc-500">Controle completo sobre instâncias de ERP do SaaS.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-zinc-400 font-mono">Carregando dados...</div>
            ) : (
              <div className="rounded-lg border border-white/5 overflow-hidden bg-slate-950/20">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 border-b border-white/5 text-zinc-400">
                    <tr>
                      <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Empresa</th>
                      <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Plano</th>
                      <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Status</th>
                      <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Cadastro</th>
                      <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          {tenant.name}
                          <div className="text-xs text-zinc-500 font-normal font-mono mt-0.5">{tenant.document || 'Sem Documento'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {tenant.plan === 'ouro' ? (
                            <span className="font-bold text-yellow-400 text-xs px-2.5 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 uppercase tracking-widest font-mono">Ouro</span>
                          ) : tenant.plan === 'prata' ? (
                            <span className="font-bold text-zinc-400 text-xs px-2.5 py-1 rounded bg-white/5 border border-white/10 uppercase tracking-widest font-mono">Prata</span>
                          ) : (
                            <span className="text-zinc-600 text-xs px-2 py-1 rounded bg-slate-900 font-mono">Nenhum</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : ''}
                            ${tenant.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : ''}
                            ${tenant.status === 'blocked' || tenant.status === 'inactive' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25' : ''}
                          `}>
                            {tenant.status === 'active' && 'Ativo'}
                            {tenant.status === 'pending' && 'Pendente'}
                            {tenant.status === 'blocked' && 'Bloqueado'}
                            {tenant.status === 'inactive' && 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                          {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {tenant.status !== 'active' && (
                              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/10 border-0"
                                onClick={() => updateTenantStatus(tenant.id, 'active')}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Liberar Acesso
                              </Button>
                            )}
                            {tenant.status === 'active' && (
                              <Button size="sm" variant="outline" className="h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                                onClick={() => updateTenantStatus(tenant.id, 'blocked')}>
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Bloquear
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-mono">Nenhuma empresa encontrada no banco de dados.</td>
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
