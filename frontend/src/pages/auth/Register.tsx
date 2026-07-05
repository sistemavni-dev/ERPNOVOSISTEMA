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
      const { error: tenantError } = await supabase
        .from('tenants')
        .insert([{
          id: authData.user.id,
          name: companyName,
          document: document,
          status: 'pending' // Status inicial aguardando aprovação
        }])

      if (tenantError) {
        // Se a RLS bloquear, pelo menos tentamos.
        console.error("Erro ao inserir tenant:", tenantError)
        setError("A conta foi criada, mas houve um erro ao registrar a empresa no banco de dados. Contate o suporte.")
        setLoading(false)
        return
      }
    }
    
    alert("Conta criada com sucesso! Aguardando aprovação do Super Admin.")
    navigate('/login')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden dark">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
      
      <div className="mb-6 flex flex-col items-center z-10">
        <div className="bg-primary/10 p-3 rounded-xl mb-4 border border-primary/20 shadow-lg shadow-primary/20">
          <Box className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">NexERP Cloud</h1>
        <p className="text-muted-foreground mt-1">Crie a conta da sua empresa</p>
      </div>

      <Card className="w-full max-w-lg z-10 border-white/10 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Cadastro de Lojista</CardTitle>
          <CardDescription>Preencha os dados para iniciar o período de avaliação.</CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="Seu Nome Completo" 
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="companyName" 
                    type="text" 
                    placeholder="Nome da Empresa" 
                    className="pl-9"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <Input 
                  id="document" 
                  type="text" 
                  placeholder="CNPJ ou CPF" 
                  className="px-3"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Senha Segura" 
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar Conta"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Já possui conta? <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/login')}>Fazer Login</Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
