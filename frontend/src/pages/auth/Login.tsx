import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { Box, Lock, Mail } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Check Role to redirect
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin')
    
    if (isSuperAdmin) {
      navigate('/super-admin')
    } else {
      navigate('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden text-foreground">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Orbes Neon Futuristas no Fundo */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-float" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px] animate-float-delayed" />
      
      <div className="mb-8 flex flex-col items-center z-10">
        <div className="bg-gradient-to-tr from-purple-600 to-cyan-400 p-4 rounded-2xl mb-4 shadow-lg shadow-purple-500/20 border border-white/10">
          <Box className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent">
          VniERP <span className="text-cyan-400">Vender+</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-mono">Gestão inteligente e segura</p>
      </div>

      <Card className="w-full max-w-md z-10 bg-card border-border shadow-2xl relative overflow-hidden">
        {/* Glow Line em cima do Card */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400" />
        
        <CardHeader className="space-y-2 text-center pt-8">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Entrar na plataforma</CardTitle>
          <CardDescription className="text-muted-foreground">Insira suas credenciais para acessar seu painel.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase">Email Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-9 h-11 bg-background border-border focus:border-purple-500 focus:ring-purple-500/25 transition-all text-foreground placeholder:text-muted-foreground"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground uppercase">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-9 h-11 bg-background border-border focus:border-purple-500 focus:ring-purple-500/25 transition-all text-foreground placeholder:text-muted-foreground"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pb-8 pt-4">
            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/25 border-0" disabled={loading}>
              {loading ? "Autenticando..." : "Entrar no Painel"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Não possui uma conta? <Button variant="link" className="p-0 h-auto text-purple-400 hover:text-purple-300 font-semibold" onClick={() => navigate('/register')}>Cadastre-se</Button>
            </div>
            <div className="w-full border-t border-border my-2 pt-2 text-center">
              <Button variant="link" className="p-0 h-auto text-muted-foreground hover:text-foreground text-xs font-mono" onClick={() => navigate('/super-admin')}>Acessar Super Admin</Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
