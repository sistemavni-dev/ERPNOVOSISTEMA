import { useEffect, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { CheckCircle, AlertCircle, LogOut, Clipboard, ExternalLink, Trash2, Crown, Lock, Building2 } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function Plans() {
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<any>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Dados do formulário Asaas
  const [billingName, setBillingName] = useState("")
  const [billingDoc, setBillingDoc] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [billingPhone, setBillingPhone] = useState("")
  const [billingMethod, setBillingMethod] = useState("pix")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Resultado do Checkout
  const [pixData, setPixData] = useState<{
    pixCode: string;
    pixQrCodeImage: string;
    invoiceUrl: string;
  } | null>(null)

  // Controle de Trial
  const [trialExpired, setTrialExpired] = useState(false)

  const checkStatus = useCallback(async () => {
    setLoading(true)
    setCheckoutError(null)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.log("No authenticated user or session missing. Redirecting to login.")
        setLoading(false)
        navigate('/login')
        return
      }

      console.log("Authenticated user found:", user.id)

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        console.log("Tenant row missing. Creating one now for auto-healing...", error)
        // Tenta criar o tenant para auto-recuperar a conta do usuário
        const { data: newTenant, error: insertError } = await supabase
          .from('tenants')
          .insert([{
            id: user.id,
            name: user.user_metadata?.full_name || "Minha Empresa",
            plan: 'ouro',
            status: 'trial',
            trial_start_at: new Date().toISOString(),
            subscription_status: 'trialing'
          }])
          .select()
          .single()

        if (insertError) {
          console.error("Erro ao auto-criar tenant:", insertError)
          throw new Error("Erro ao auto-criar dados da empresa no banco: " + insertError.message + " (Detalhes: " + insertError.details + ")")
        } else {
          console.log("Tenant auto-created successfully:", newTenant)
          setTenant(newTenant)
          setBillingName(newTenant.name || "")
          setBillingDoc(newTenant.document || "")
          setBillingEmail(user.email || "")
          setBillingPhone(newTenant.whatsapp_number || "")
        }
      } else {
        console.log("Tenant data loaded successfully:", data)
        setTenant(data)
        setBillingName(data.name || "")
        setBillingDoc(data.document || "")
        setBillingEmail(user.email || "")
        setBillingPhone(data.whatsapp_number || "")

        const trialStart = data.trial_start_at ? new Date(data.trial_start_at) : null
        const trialEnds = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null
        const expired = trialEnds ? trialEnds < new Date() : false
        setTrialExpired(expired || data.status === 'suspended')

        // Permite visualizar a página de planos mesmo se estiver ativo
        // if (data.subscription_status === 'active' && !expired) {
        //   navigate('/dashboard')
        // }
      }
    } catch (err: any) {
      console.error("Erro ao carregar status do tenant:", err)
      setCheckoutError(err.message || "Erro desconhecido ao carregar dados da empresa.")
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleSubscribe = (planType: string) => {
    setCheckoutPlan(planType)
    setPixData(null)
  }

  const handleAsaasCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant) {
      setCheckoutError("Erro interno: Os dados da sua empresa (tenant) não foram carregados corretamente. Recarregue a página.")
      return
    }
    if (!checkoutPlan) {
      setCheckoutError("Erro interno: Plano de destino não selecionado.")
      return
    }

    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      // Obter sessão atual
      const { data: { session } } = await supabase.auth.getSession()
      console.log("Detalhes da sessão ativa:", session)

      if (!session || !session.access_token) {
        throw new Error("Sessão de usuário não encontrada ou expirada. Por favor, saia e faça login novamente.")
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-asaas-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          name: billingName,
          email: billingEmail,
          document: billingDoc,
          phone: billingPhone,
          plan: checkoutPlan,
          paymentMethod: billingMethod
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Erro desconhecido ao processar pagamento.")
      }

      setPixData({
        pixCode: result.pixCode,
        pixQrCodeImage: result.pixQrCodeImage,
        invoiceUrl: result.invoiceUrl
      })

      // Atualiza estado local do tenant
      setTenant((prev: any) => ({
        ...prev,
        subscription_status: 'pending',
        plan: checkoutPlan
      }))

    } catch (err: any) {
      console.error(err)
      setCheckoutError(err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleCancelRegistration = async () => {
    if (!confirm("Tem certeza que deseja cancelar e excluir permanentemente seu cadastro? Esta ação não pode ser desfeita.")) {
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-registration`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erro ao cancelar cadastro.")
      }

      await supabase.auth.signOut()
      alert("Cadastro cancelado com sucesso. Sentiremos sua falta!")
      navigate('/login')
    } catch (err: any) {
      alert(err.message)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert("Código PIX copiado para a área de transferência!")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">Carregando planos...</div>
  }

  const isBlocked = searchParams.get('blocked') === 'true' || trialExpired;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 text-foreground relative overflow-hidden flex flex-col justify-center">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 w-full">
        
        {/* Erro Geral ao Carregar Dados */}
        {checkoutError && !checkoutPlan && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <h3 className="font-bold text-white text-sm">Erro ao carregar dados da empresa</h3>
              <p className="text-zinc-400 text-xs mt-0.5">{checkoutError}</p>
            </div>
          </div>
        )}

        {/* Banner de Expiração de Teste */}
        {isBlocked && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col md:flex-row items-center gap-4 text-center md:text-left justify-between shadow-lg shadow-rose-950/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-rose-400 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-base">Seu período de teste de 7 dias expirou!</h3>
                <p className="text-zinc-400 text-sm mt-0.5">Para continuar acessando o sistema, ative um plano ou solicite o cancelamento de cadastro.</p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleCancelRegistration} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
              <Trash2 className="w-4 h-4 mr-2" /> Cancelar Cadastro
            </Button>
          </div>
        )}

        <div className="flex justify-between items-center mb-12 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">Escolha seu Plano</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {tenant?.subscription_status === 'trialing' && tenant?.trial_start_at
                ? `Você está no período de avaliação de 7 dias (termina em: ${new Date(new Date(tenant.trial_start_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')})` 
                : 'Selecione uma assinatura para liberar seus acessos de forma ilimitada.'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {!isBlocked && (
              <Button variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => navigate('/dashboard')}>
                Voltar ao Painel
              </Button>
            )}
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Banner do Plano Atual */}
        {tenant && (
          <div className="mb-8 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Seu Plano Atual: <span className="uppercase text-purple-400 font-extrabold">{tenant.plan || 'Nenhum'}</span></h3>
                <p className="text-zinc-400 text-xs mt-0.5">Status: <span className="capitalize font-semibold text-emerald-400">
                  {tenant.status === 'pending' && tenant.subscription_status === 'pending' 
                    ? 'Aguardando Liberação do Administrador' 
                    : (tenant.subscription_status === 'active' 
                      ? 'Ativo' 
                      : (tenant.subscription_status === 'trialing' ? 'Período de Teste (Trial)' : tenant.subscription_status))}
                </span></p>
              </div>
            </div>
            {tenant.subscription_status === 'trialing' && tenant.trial_start_at && (
              <span className="text-xs text-zinc-400 font-mono">Expira em: {new Date(new Date(tenant.trial_start_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        )}

        {/* Formulário / Modal de Checkout Asaas */}
        {checkoutPlan && (
          <Card className="mb-12 bg-card border-purple-500/30 shadow-2xl relative overflow-hidden max-w-2xl mx-auto">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500" />
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold text-card-foreground">Assinar Plano {checkoutPlan.toUpperCase()}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCheckoutPlan(null)} className="text-muted-foreground hover:text-foreground">Fechar</Button>
              </div>
              <CardDescription className="text-muted-foreground">Insira as informações para a geração do seu pagamento recorrente via Asaas.</CardDescription>
            </CardHeader>
            <CardContent>
              {checkoutError && (
                <div className="mb-4 p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-md break-all">
                  {checkoutError}
                </div>
              )}
              {!pixData ? (
                <form onSubmit={handleAsaasCheckout} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-400 uppercase">Nome Fantasia / Razão Social</label>
                      <Input 
                        value={billingName} 
                        onChange={e => setBillingName(e.target.value)} 
                        required 
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">CPF / CNPJ da Empresa</label>
                      <Input 
                        value={billingDoc} 
                        onChange={e => setBillingDoc(e.target.value)} 
                        required 
                        placeholder="Apenas números"
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-zinc-400 uppercase">Email de Faturamento</label>
                      <Input 
                        type="email" 
                        value={billingEmail} 
                        onChange={e => setBillingEmail(e.target.value)} 
                        required 
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-muted-foreground uppercase">WhatsApp para Notificações</label>
                      <Input 
                        value={billingPhone} 
                        onChange={e => setBillingPhone(e.target.value)} 
                        placeholder="Ex: 5511999999999"
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-muted-foreground uppercase">Forma de Pagamento</label>
                    <select
                      className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                      value={billingMethod}
                      onChange={(e) => setBillingMethod(e.target.value)}
                    >
                      <option value="pix">PIX (Confirmação Imediata)</option>
                      <option value="card">Cartão de Crédito (Confirmação Imediata)</option>
                      <option value="boleto">Boleto Bancário (Compensação em até 48 horas úteis)</option>
                    </select>
                  </div>

                  <Button type="submit" disabled={checkoutLoading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold h-11 border-0 shadow-lg shadow-purple-500/25 mt-2">
                    {checkoutLoading ? "Processando Assinatura no Asaas..." : `Gerar Assinatura (R$ ${checkoutPlan === 'ouro' ? '199,90' : checkoutPlan === 'prata' ? '109,90' : '49,90'}/mês)`}
                  </Button>
                </form>
              ) : (
                <div className="text-center space-y-6 py-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-sm">
                    Sua assinatura do plano **{checkoutPlan.toUpperCase()}** foi registrada com sucesso!
                  </div>

                  {billingMethod === 'pix' && (
                    <>
                      {pixData.pixQrCodeImage ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="bg-white p-3 rounded-xl border border-white/10 max-w-[200px]">
                            <img src={`data:image/png;base64,${pixData.pixQrCodeImage}`} alt="PIX QR Code" className="w-40 h-40" />
                          </div>
                          <p className="text-xs text-zinc-400">Escaneie o código acima no app do seu banco para pagar.</p>
                        </div>
                      ) : null}

                      {pixData.pixCode && (
                        <div className="space-y-2">
                          <label className="text-xs font-mono text-muted-foreground uppercase">PIX Copia e Cola</label>
                          <div className="flex gap-2 max-w-md mx-auto">
                            <Input value={pixData.pixCode} readOnly className="bg-background border-border text-foreground font-mono text-xs" />
                            <Button size="icon" variant="outline" className="border-border hover:bg-muted shrink-0" onClick={() => copyToClipboard(pixData.pixCode)}>
                              <Clipboard className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {billingMethod === 'boleto' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg p-4 text-sm max-w-md mx-auto text-left space-y-2">
                      <p className="font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-amber-400" /> Boleto de Cobrança Gerado</p>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        O boleto bancário leva **até 48 horas úteis** após o pagamento para ser totalmente compensado e liberado pelo banco.
                      </p>
                      <p className="text-zinc-300 text-xs">
                        Clique no botão abaixo para abrir, imprimir ou realizar o pagamento do boleto bancário.
                      </p>
                    </div>
                  )}

                  {billingMethod === 'card' && (
                    <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg p-4 text-sm max-w-md mx-auto text-left space-y-2">
                      <p className="font-bold">Pagamento via Cartão de Crédito</p>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        Para a sua segurança, o pagamento via cartão de crédito é processado no ambiente seguro do Asaas.
                      </p>
                      <p className="text-zinc-300 text-xs">
                        Clique no botão de faturamento abaixo para preencher os dados do seu cartão e ativar a assinatura imediatamente.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    {pixData.invoiceUrl && (
                      <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold" asChild>
                        <a href={pixData.invoiceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" /> 
                          {billingMethod === 'pix' ? 'Abrir Fatura no Asaas' : billingMethod === 'boleto' ? 'Visualizar / Imprimir Boleto' : 'Preencher Cartão no Asaas'}
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5" onClick={checkStatus}>
                      Já realizei o pagamento / preenchi
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch max-w-[1400px] mx-auto px-4">
          
          {/* Plano Bronze */}
          <Card className="bg-card border-border hover:border-zinc-500/30 shadow-md hover:shadow-2xl transition-all flex flex-col justify-between">
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold text-amber-600">Plano Bronze</CardTitle>
              <CardDescription className="text-muted-foreground">Ideal para começar e focar nas vendas.</CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-black text-foreground">R$ 49,90</span><span className="text-muted-foreground text-sm">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 flex-1">
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-amber-500" /> Gestão de Produtos/Estoque, PDV e CRM</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><Lock className="w-4 h-4" /> Trava Fiscal: 0 NF-e/mês (Bloqueado)</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><Lock className="w-4 h-4" /> Trava de Mensageria: Bloqueado (Sem Whats/Telegram)</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><Lock className="w-4 h-4" /> Vitrine Virtual: Bloqueado</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                variant="outline" 
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-700/30 hover:border-zinc-600 transition-all h-11"
                onClick={() => handleSubscribe('bronze')}
              >
                Assinar Plano Bronze
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Prata */}
          <Card className="bg-card border-border hover:border-zinc-500/30 shadow-md hover:shadow-2xl transition-all flex flex-col justify-between">
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">Plano Prata</CardTitle>
              <CardDescription className="text-muted-foreground">Gestão completa e PDV para o seu comércio.</CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-black text-foreground">R$ 109,90</span><span className="text-muted-foreground text-sm">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 flex-1">
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> Tudo do Bronze + Finanças, Orçamentos e Fornecedores</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> Trava Fiscal: Até 100 NF-e/mês</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-zinc-400" /> WhatsApp Liberado (Apenas Comprovantes PDV)</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><Lock className="w-4 h-4" /> Vitrine Virtual: Bloqueado</li>
                <li className="flex items-center gap-2 text-zinc-600 opacity-60"><Lock className="w-4 h-4" /> Agente de IA (Telegram): Bloqueado</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                variant="outline" 
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-700/30 hover:border-zinc-600 transition-all h-11"
                onClick={() => handleSubscribe('prata')}
              >
                Assinar Plano Prata
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Ouro */}
          <Card className="bg-card border-purple-500/20 shadow-xl hover:border-purple-400/40 transition-all scale-100 lg:scale-105 z-10 flex flex-col justify-between">
            <CardHeader className="bg-purple-900/10 rounded-t-lg pt-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl-lg">Recomendado</div>
              <CardTitle className="text-2xl font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-500" /> Plano Ouro 
              </CardTitle>
              <CardDescription className="text-muted-foreground">Automação de Telegram, IA e Clube VIP.</CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-black text-purple-600 dark:text-purple-400">R$ 199,90</span><span className="text-muted-foreground text-sm">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 flex-1">
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Tudo do Prata + Vitrine Virtual Ilimitada</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Trava Fiscal: Até 300 NF-e/mês</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-purple-500 mt-0.5" /> <div><span className="font-bold">WhatsApp Liberado + Agente de IA do Telegram Ativo</span> (Diretrizes e Módulos de Atuação)</div></li>
                <li className="flex items-center gap-2 font-bold text-purple-400 bg-purple-950/20 p-2.5 rounded-md border border-purple-500/10 mt-2"><CheckCircle className="w-4 h-4 text-purple-400" /> Suporte Prioritário 24/7</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                variant="outline"
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-700/30 hover:border-zinc-600 transition-all h-11"
                onClick={() => handleSubscribe('ouro')}
              >
                Assinar Plano Ouro
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Enterprise */}
          <Card className="bg-card border-border hover:border-zinc-500/30 shadow-md hover:shadow-2xl transition-all flex flex-col justify-between">
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold text-emerald-500 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-500" /> Enterprise
              </CardTitle>
              <CardDescription className="text-muted-foreground">Para operações de alto volume.</CardDescription>
              <div className="mt-6 flex items-center h-[48px]">
                <span className="text-3xl font-black text-foreground">Sob Consulta</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 flex-1">
              <ul className="space-y-3 text-sm text-foreground">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Tudo do Plano Ouro</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Trava Fiscal: Até 2.000 NF-e/mês</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Suporte Prioritário (WhatsApp)</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Gerente de Conta Dedicado</li>
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button 
                variant="outline" 
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-700/30 hover:border-zinc-600 transition-all h-11"
                onClick={() => window.open('https://wa.me/5511999999999?text=Olá,%20tenho%20interesse%20no%20Plano%20Enterprise', '_blank')}
              >
                Falar com um Consultor
              </Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </div>
  )
}
