import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { ShieldCheck } from "lucide-react"

export default function AcceptTerms() {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleAccept = async () => {
    if (!acceptedTerms) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    const { error } = await supabase
      .from('tenants')
      .update({
        accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
        terms_version: 'v1.0'
      })
      .eq('id', user.id)

    if (error) {
      console.error("Erro ao aceitar termos:", error)
      alert("Houve um erro ao processar. Tente novamente.")
      setLoading(false)
      return
    }

    // Sucesso, manda para o dashboard
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-foreground relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-float" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[150px] animate-float-delayed" />

      <Card className="w-full max-w-lg z-10 bg-card border-border shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400" />
        
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto bg-purple-500/10 p-4 rounded-full w-fit mb-4">
            <ShieldCheck className="w-12 h-12 text-purple-500" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Atualização nos Termos de Uso</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Atualizamos nossos Termos de Uso e Política de Privacidade para garantir conformidade com a LGPD e oferecer mais transparência.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground border border-border">
            Para continuar utilizando a plataforma e acessar seu painel, você precisa ler e concordar com os documentos atualizados.
          </div>

          <div className="flex items-start gap-3 pt-4 border-t border-border mt-4">
            <input 
              type="checkbox" 
              id="terms" 
              className="w-5 h-5 accent-purple-600 cursor-pointer mt-0.5 shrink-0"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <label htmlFor="terms" className="text-sm text-foreground select-none cursor-pointer">
              Li e concordo com os novos <a href="/termos-de-uso" target="_blank" className="text-purple-500 hover:underline font-medium">Termos de Uso</a> e com a <a href="/politica-privacidade" target="_blank" className="text-purple-500 hover:underline font-medium">Política de Privacidade</a>.
            </label>
          </div>
        </CardContent>

        <CardFooter className="pb-8 pt-4">
          <Button 
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/25 border-0" 
            disabled={!acceptedTerms || loading}
            onClick={handleAccept}
          >
            {loading ? "Confirmando..." : "Confirmar e Acessar"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
