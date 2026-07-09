import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { Box, User, Mail, Lock, Building } from "lucide-react"

export default function Register() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [document, setDocument] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1. Criar Auth User (O trigger e RLS exigirão Tenant no futuro, mas o Supabase Auth cria primeiro)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Inserir a Empresa (Tenant) no banco de dados.
    // Usaremos o ID do usuário recém criado como ID do Tenant para amarrar a conta.
    if (authData.user) {
      const query = new URLSearchParams(window.location.search)
      const selectedPlan = query.get('plan') || 'prata' // plano padrão se não vier na URL

      const { error: tenantError } = await supabase
        .from('tenants')
        .insert([{
          id: authData.user.id,
          name: companyName,
          document: document,
          plan: selectedPlan,
          status: 'active', // Fica ativo durante o período de testes
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_status: 'trialing'
        }])

      if (tenantError) {
        // Se a RLS bloquear, pelo menos tentamos.
        console.error("Erro ao inserir tenant:", tenantError)
        setError("A conta foi criada, mas houve um erro ao registrar a empresa no banco de dados. Contate o suporte.")
        setLoading(false)
        return
      }
    }
    
    // Conta criada e sessão iniciada automaticamente pelo Supabase!
    // Redireciona direto para a escolha do plano.
    navigate('/planos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 relative overflow-hidden dark text-foreground">
      {/* Orbes Neon Futuristas no Fundo */}
      <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-float" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px] animate-float-delayed" />
      
      <div className="mb-6 flex flex-col items-center z-10">
        <div className="bg-gradient-to-tr from-purple-600 to-cyan-400 p-4 rounded-2xl mb-4 shadow-lg shadow-purple-500/20 border border-white/10">
          <Box className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent">
          NexERP Cloud
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-mono">Crie a conta da sua empresa</p>
      </div>

      <Card className="w-full max-w-lg z-10 bg-glass border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow Line em cima do Card */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400" />
        
        <CardHeader className="space-y-1 text-center pt-8">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Cadastro de Lojista</CardTitle>
          <CardDescription className="text-zinc-400">Preencha os dados para iniciar o período de avaliação.</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-400 uppercase">Seu Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="Seu Nome Completo" 
                    className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-400 uppercase">Nome da Empresa</label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    id="companyName" 
                    type="text" 
                    placeholder="Nome da Empresa" 
                    className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400 uppercase">CNPJ ou CPF</label>
              <div className="relative">
                <Input 
                  id="document" 
                  type="text" 
                  placeholder="00.000.000/0001-00" 
                  className="px-3 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400 uppercase">Email Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400 uppercase">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Senha Segura" 
                  className="pl-9 h-11 bg-slate-900/50 border-white/5 focus:border-purple-500 focus:ring-purple-500/25 transition-all text-white placeholder:text-zinc-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-8 pt-4">
            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/25 border-0" disabled={loading}>
              {loading ? "Criando conta..." : "Criar Minha Conta"}
            </Button>
            <div className="text-center text-sm text-zinc-400">
              Já possui conta? <Button variant="link" className="p-0 h-auto text-purple-400 hover:text-purple-300 font-semibold" onClick={() => navigate('/login')}>Fazer Login</Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
