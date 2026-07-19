import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { User, ArrowLeft, Save, Mail } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function Profile() {
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setEmail(user.email || "")
      setFullName(user.user_metadata?.full_name || "")
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    })

    if (error) {
      alert("Erro ao atualizar o perfil: " + error.message)
    } else {
      alert("Perfil atualizado com sucesso! O seu nome agora aparecerá no painel.")
    }
    
    setLoading(false)
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen text-foreground">
      <div className="mb-8 flex justify-between items-center max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <User className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Meu Perfil
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie seus dados pessoais.</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Estes dados identificam você no sistema.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdate}>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
                  <Input 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    placeholder="Ex: João da Silva" 
                    className="pl-10"
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">E-mail de Login</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
                  <Input 
                    value={email} 
                    disabled
                    className="pl-10 bg-muted/50 cursor-not-allowed text-zinc-400"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">O e-mail é utilizado para acesso e não pode ser alterado por aqui.</p>
              </div>

              <div className="pt-4 border-t border-border">
                <Button type="submit" className="w-full h-12 text-md" disabled={loading}>
                  <Save className="w-5 h-5 mr-2" /> 
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>

            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
