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
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 dark text-foreground relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse" />

        <Card className="w-full max-w-md bg-slate-950/50 backdrop-blur-xl border border-primary/30 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
          <CardHeader className="pt-8">
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 border border-primary/30">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Aguardando Pagamento</CardTitle>
            <CardDescription className="text-zinc-400">Sua assinatura foi registrada e está em análise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-300 text-sm">
              Você escolheu o <strong className="text-white">Plano {tenant.plan === 'ouro' ? 'Ouro' : 'Prata'}</strong>. 
              Por favor, realize o pagamento via PIX para o Administrador e aguarde a liberação do seu painel.
            </p>
            <div className="p-4 bg-slate-900/60 rounded-lg border border-white/5 shadow-inner">
              <p className="font-mono text-xs break-all text-zinc-300">00020126360014br.gov.bcb.pix0114+5511999999999...</p>
              <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-wider font-mono">(Chave PIX Fictícia para teste)</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center pb-8 pt-4">
            <Button variant="outline" onClick={handleLogout} className="w-full border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Se não tem plano escolhido ainda
  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 dark text-foreground relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse" />

      <div className="max-w-5xl mx-auto relative z-10">
        
        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Escolha seu Plano</h1>
            <p className="text-zinc-400 mt-2 text-sm">Para começar a usar o ERP, selecione uma assinatura.</p>
          </div>
          {tenant ? (
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          ) : (
            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5" onClick={() => navigate('/login')}>
              Entrar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* Plano Prata */}
          <Card className="bg-slate-950/50 backdrop-blur-xl border border-white/5 hover:border-zinc-500/30 transition-all flex flex-col justify-between hover:shadow-2xl">
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold text-zinc-400">Plano Prata</CardTitle>
              <CardDescription className="text-zinc-500">O essencial para gerenciar seu negócio e vitrine virtual.</CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-black text-white">R$ 49,90</span><span className="text-zinc-500 text-sm">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 flex-1">
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> <Store className="w-4 h-4 text-zinc-500"/> Vitrine Virtual Ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> <Package className="w-4 h-4 text-zinc-500"/> Gestão de Produtos e Estoque</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> <DollarSign className="w-4 h-4 text-zinc-500"/> PDV e Financeiro</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> Controle de Fiados e Cashback</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><AlertCircle className="w-4 h-4" /> <MessageCircle className="w-4 h-4"/> Sem integração automática com WhatsApp</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                variant="outline" 
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-700/30 hover:border-zinc-600 transition-all h-11"
                onClick={() => handleSubscribe('prata')}
                disabled={loading}
              >
                Assinar Plano Prata
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Ouro */}
          <Card className="bg-slate-950/50 backdrop-blur-xl border border-purple-500/20 hover:border-purple-400/40 transition-all scale-100 md:scale-105 z-10 flex flex-col justify-between">
            <CardHeader className="bg-purple-900/10 rounded-t-lg pt-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl-lg">Recomendado</div>
              <CardTitle className="text-2xl font-bold text-purple-400">Plano Ouro</CardTitle>
              <CardDescription className="text-zinc-500">Tudo do Prata + Automação de Mensagens.</CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-black text-purple-400">R$ 99,90</span><span className="text-zinc-500 text-sm">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 flex-1">
              <ul className="space-y-3 text-sm text-zinc-300">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> <Store className="w-4 h-4 text-purple-500"/> Vitrine Virtual Ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> <Package className="w-4 h-4 text-purple-500"/> Gestão de Produtos e Estoque</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> <DollarSign className="w-4 h-4 text-purple-500"/> PDV e Financeiro</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Controle de Fiados e Cashback</li>
                <li className="flex items-center gap-2 font-bold text-purple-400 bg-purple-950/20 p-2.5 rounded-md border border-purple-500/10"><CheckCircle className="w-4 h-4 text-purple-400" /> <MessageCircle className="w-4 h-4 text-purple-400"/> Notificações via WhatsApp p/ Clientes</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-500/25 border-0"
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
