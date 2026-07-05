import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card"
import { CheckCircle, AlertCircle, LogOut, MessageCircle, Package, DollarSign, Store } from "lucide-react"

export default function Plans() {
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
    } else {
      setTenant(data)
      // Se já está ativo, manda direto pro dashboard
      if (data.status === 'active') {
        navigate('/dashboard')
      }
    }
    setLoading(false)
  }

  const handleSubscribe = async (planType: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate(`/register?plan=${planType}`)
      return
    }

    if (!tenant) return
    setLoading(true)
    
    // Atualiza o plano no banco
    const { error } = await supabase
      .from('tenants')
      .update({ plan: planType })
      .eq('id', tenant.id)

    if (error) {
      alert("Erro ao escolher o plano: " + error.message)
      setLoading(false)
      return
    }

    // Recarrega o estado local
    checkStatus()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark">Carregando...</div>
  }

  // Se já escolheu o plano mas ainda está pendente de pagamento
  if (tenant?.plan && tenant?.status === 'pending') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 dark text-foreground">
        <Card className="w-full max-w-md border-primary/50 shadow-lg shadow-primary/20 text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Aguardando Pagamento</CardTitle>
            <CardDescription>Sua assinatura foi registrada e está em análise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Você escolheu o <strong>Plano {tenant.plan === 'ouro' ? 'Ouro' : 'Prata'}</strong>. 
              Por favor, realize o pagamento via PIX para o Administrador e aguarde a liberação do seu painel.
            </p>
            <div className="p-4 bg-muted rounded-md border border-border">
              <p className="font-mono text-sm break-all">00020126360014br.gov.bcb.pix0114+5511999999999...</p>
              <p className="text-xs text-muted-foreground mt-2">(Chave PIX Fictícia para teste)</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Se não tem plano escolhido ainda
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 dark text-foreground">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Escolha seu Plano</h1>
            <p className="text-muted-foreground mt-2">Para começar a usar o ERP, selecione uma assinatura.</p>
          </div>
          {tenant ? (
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Entrar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Plano Prata */}
          <Card className="border-border hover:border-zinc-500 transition-all">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-zinc-400">Plano Prata</CardTitle>
              <CardDescription>O essencial para gerenciar seu negócio e vitrine virtual.</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-black">R$ 49,90</span><span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <Store className="w-4 h-4 text-muted-foreground"/> Vitrine Virtual Ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <Package className="w-4 h-4 text-muted-foreground"/> Gestão de Produtos e Estoque</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <DollarSign className="w-4 h-4 text-muted-foreground"/> PDV (Frente de Caixa) e Financeiro</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Controle de Fiados e Cashback</li>
                <li className="flex items-center gap-2 text-muted-foreground opacity-50"><AlertCircle className="w-4 h-4" /> <MessageCircle className="w-4 h-4"/> Sem integração automática com WhatsApp</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full text-zinc-400 border-zinc-500 hover:bg-zinc-500 hover:text-white"
                onClick={() => handleSubscribe('prata')}
                disabled={loading}
              >
                Assinar Plano Prata
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Ouro */}
          <Card className="border-primary shadow-lg shadow-primary/20 hover:border-primary/80 transition-all scale-100 md:scale-105 z-10 bg-card">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full w-max mb-2">Recomendado</div>
              <CardTitle className="text-2xl font-bold text-primary">Plano Ouro</CardTitle>
              <CardDescription>Tudo do Prata + Automação de Mensagens.</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-black text-primary">R$ 99,90</span><span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <Store className="w-4 h-4 text-muted-foreground"/> Vitrine Virtual Ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <Package className="w-4 h-4 text-muted-foreground"/> Gestão de Produtos e Estoque</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> <DollarSign className="w-4 h-4 text-muted-foreground"/> PDV (Frente de Caixa) e Financeiro</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Controle de Fiados e Cashback</li>
                <li className="flex items-center gap-2 font-bold text-primary bg-primary/10 p-2 rounded-md"><CheckCircle className="w-4 h-4 text-primary" /> <MessageCircle className="w-4 h-4 text-primary"/> Notificações via WhatsApp p/ Clientes</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full text-lg font-bold"
                onClick={() => handleSubscribe('ouro')}
                disabled={loading}
              >
                Assinar Plano Ouro
              </Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </div>
  )
}
