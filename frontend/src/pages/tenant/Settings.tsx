import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Settings as SettingsIcon, ArrowLeft, Save, Building2, Store, Bot, Smartphone, FileKey } from "lucide-react"
import { ThemeToggle } from "../../components/ThemeToggle"
import { encryptData } from "../../lib/utils"

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)

  // Dados da Empresa
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [address, setAddress] = useState("")
  const [accountantEmail, setAccountantEmail] = useState("")
  const [ie, setIe] = useState("")
  const [taxRegime, setTaxRegime] = useState("Simples Nacional")
  const [certificatePassword, setCertificatePassword] = useState("")
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [hasCertificate, setHasCertificate] = useState(false)
  const [nfeCount, setNfeCount] = useState(0)

  // Vitrine Virtual
  const [storeSlug, setStoreSlug] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [plan, setPlan] = useState<string | null>(null)
  const [themeColor, setThemeColor] = useState("dark")

  // Estados do Agente de Telegram
  const [agentEnabled, setAgentEnabled] = useState(false)
  const [botToken, setBotToken] = useState("")
  const [botUsername, setBotUsername] = useState("")
  const [agentPrompt, setAgentPrompt] = useState("Você é um atendente simpático. Tire dúvidas de clientes.")
  const [handoffEnabled, setHandoffEnabled] = useState(true)
  const [features, setFeatures] = useState<string[]>([])
  const [webhookStatus, setWebhookStatus] = useState<"disconnected" | "connected" | "error">("disconnected")

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setProfileId(user.id)
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.id)
        .single()
        
      if (tenant) {
        setName(tenant.name || "")
        setDocument(tenant.document || "")
        setAddress(tenant.address || "")
        setAccountantEmail(tenant.accountant_email || "")
        setStoreSlug(tenant.store_slug || "")
        setWhatsapp(tenant.whatsapp_number || "")
        setStoreDescription(tenant.store_description || "")
        setPlan(tenant.plan)
        setThemeColor(tenant.theme_color || "dark")
        setIe(tenant.ie || "")
        setTaxRegime(tenant.tax_regime || "Simples Nacional")
        setHasCertificate(!!tenant.certificate_a1_path)
      }

      // Buscar configurações do agente do telegram
      const { data: agent } = await supabase
        .from('telegram_agents')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (agent) {
        setAgentEnabled(agent.is_active)
        setBotToken(agent.bot_token || "")
        setBotUsername(agent.bot_username || "")
        setAgentPrompt(agent.agent_prompt || "Você é um atendente simpático. Tire dúvidas de clientes.")
        setHandoffEnabled(agent.handoff_enabled)
        setFeatures(agent.features || [])
        setWebhookStatus(agent.webhook_status || "disconnected")
      }

      // Buscar total de notas emitidas no mês atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);
      
      const { count } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .eq('nfe_status', 'emitida');
        
      if (count !== null) setNfeCount(count);
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    
    setLoading(true)
    setSuccess(false)
    
    let certPath = undefined
    let certPassword = undefined
    
    if (certificateFile) {
      const fileName = `${profileId}/certificado.pfx`
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, certificateFile, { upsert: true })
        
      if (uploadError) {
        alert("Erro no upload do certificado: " + uploadError.message)
        setLoading(false)
        return
      }
      certPath = fileName
    }

    if (certificatePassword) {
      certPassword = encryptData(certificatePassword)
    }

    const updatePayload: any = {
      name,
      document,
      ie,
      tax_regime: taxRegime,
      address,
      accountant_email: accountantEmail,
      store_slug: storeSlug || null,
      whatsapp_number: whatsapp,
      store_description: storeDescription,
      theme_color: themeColor
    }

    if (certPath) updatePayload.certificate_a1_path = certPath
    if (certPassword) updatePayload.certificate_a1_password = certPassword

    const { error } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', profileId)

    // Salvar configurações do agente em conjunto
    let currentWebhookStatus = webhookStatus
    if (botToken) {
      currentWebhookStatus = 'connected'
      // Registrar webhook silenciosamente no Telegram
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook?tenant_id=${profileId}`
      fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`)
        .catch(console.error)
    } else {
      currentWebhookStatus = 'disconnected'
    }

    await supabase
      .from('telegram_agents')
      .upsert({
        id: profileId,
        bot_token: botToken,
        bot_username: botUsername,
        is_active: agentEnabled,
        features: features,
        agent_prompt: agentPrompt,
        handoff_enabled: handoffEnabled,
        webhook_status: currentWebhookStatus
      })

    setWebhookStatus(currentWebhookStatus)

    setLoading(false)

    if (error) {
      if (error.code === '23505') {
        alert("Este Link da Loja já está em uso por outra empresa. Escolha outro.")
      } else {
        alert("Erro ao salvar configurações: " + error.message)
      }
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  // Testar conexão com Telegram
  const handleTestBot = async () => {
    if (!botToken) {
      alert("Por favor, preencha o Token do Bot e salve as configurações primeiro.")
      return
    }
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      const data = await resp.json()
      if (data.ok) {
        alert(`Conectado com sucesso ao bot: @${data.result.username}`)
        setBotUsername(data.result.username)
        setWebhookStatus("connected")
      } else {
        alert("Erro ao validar Token do Telegram. Verifique se copiou corretamente do @BotFather.")
        setWebhookStatus("error")
      }
    } catch (e: any) {
      alert("Erro na conexão: " + e.message)
      setWebhookStatus("error")
    }
  }

  const toggleFeature = (feat: string) => {
    setFeatures(prev => 
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    )
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen text-foreground">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center max-w-4xl mx-auto gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Configurações
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie os dados da sua empresa e vitrine virtual.</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Dados da Empresa */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" /> Dados da Empresa
                </CardTitle>
                <CardDescription>Informações que sairão no cabeçalho do recibo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Razão Social / Nome Fantasia</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    placeholder="Sua Empresa Ltda" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CNPJ / CPF</label>
                  <Input 
                    value={document} 
                    onChange={e => setDocument(e.target.value)} 
                    placeholder="00.000.000/0001-00" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço Completo</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    placeholder="Rua Exemplo, 123 - Centro, São Paulo - SP" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-mail do Contador</label>
                  <Input 
                    type="email"
                    value={accountantEmail} 
                    onChange={e => setAccountantEmail(e.target.value)} 
                    placeholder="contador@escritorio.com.br" 
                  />
                </div>
                
                <hr className="border-border my-4" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <FileKey className="w-4 h-4" /> Faturamento e NFe
                  </h3>
                  {plan !== 'bronze' && (
                    <div className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md border border-border shadow-sm">
                      Notas emitidas este mês: <span className="text-foreground font-bold">{nfeCount} / {plan === 'enterprise' ? 2000 : (plan === 'ouro' ? 300 : 100)}</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Inscrição Estadual (IE)</label>
                    <Input 
                      value={ie} 
                      onChange={e => setIe(e.target.value)} 
                      placeholder="Números ou ISENTO" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Regime Tributário</label>
                    <select 
                      value={taxRegime} 
                      onChange={e => setTaxRegime(e.target.value)} 
                      className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Simples Nacional">Simples Nacional</option>
                      <option value="Lucro Presumido">Lucro Presumido</option>
                      <option value="Lucro Real">Lucro Real</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2 mt-2 p-4 bg-muted/50 rounded-lg border border-border">
                  <label className="text-sm font-medium block mb-2">Certificado Digital A1 (.pfx, .p12)</label>
                  {plan === 'bronze' ? (
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground border border-border flex flex-col md:flex-row items-center justify-between gap-3">
                      <span>Emissão de Notas Fiscais é exclusiva dos planos Prata e Ouro.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate('/planos')}>Fazer Upgrade</Button>
                    </div>
                  ) : (
                    <>
                  {hasCertificate && (
                    <div className="text-xs text-emerald-500 mb-2 font-medium flex items-center gap-1">
                      Certificado instalado. Envie um novo arquivo caso precise atualizar.
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept=".pfx,.p12"
                    onChange={e => setCertificateFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  <div className="mt-3">
                    <label className="text-xs font-medium">Senha do Certificado</label>
                    <Input 
                      type="password"
                      value={certificatePassword} 
                      onChange={e => setCertificatePassword(e.target.value)} 
                      placeholder={hasCertificate ? "Deixe em branco para manter a atual" : "Senha de importação"} 
                      className="mt-1"
                    />
                  </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vitrine Virtual */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" /> Vitrine Virtual
                </CardTitle>
                <CardDescription>Configure como seus clientes verão sua loja online.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan === 'bronze' || plan === 'prata' ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4 bg-muted/50 rounded-lg border border-dashed border-border">
                    <Store className="w-10 h-10 text-muted-foreground opacity-50" />
                    <div>
                      <h3 className="font-bold text-foreground">Vitrine Virtual Bloqueada</h3>
                      <p className="text-muted-foreground text-xs mt-1">Disponível apenas no Plano Ouro.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/planos')}>Fazer Upgrade</Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                  <label className="text-sm font-medium">Link da Loja (ex: lojadox)</label>
                  <Input 
                    value={storeSlug} 
                    onChange={e => setStoreSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                    placeholder="nome-da-sua-loja" 
                  />
                  {storeSlug && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Seu link público é: <br/>
                      <a 
                        href={`${window.location.origin}/loja/${storeSlug}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-primary font-bold hover:underline"
                      >
                        {window.location.origin}/loja/{storeSlug}
                      </a>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp p/ Pedidos Automáticos</label>
                  <Input 
                    value={whatsapp} 
                    onChange={e => setWhatsapp(e.target.value)} 
                    placeholder="5511999999999" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição da Loja</label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={storeDescription} 
                    onChange={e => setStoreDescription(e.target.value)} 
                    placeholder="Bem-vindo à nossa loja! Faça seu pedido abaixo." 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tema da Vitrine</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button type="button" onClick={() => setThemeColor('dark')} className={`p-4 border rounded-xl flex items-center justify-center font-bold text-sm transition-all ${themeColor === 'dark' ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-foreground'}`}>
                      <div className="w-4 h-4 rounded-full bg-slate-950 border border-zinc-700 mr-2" />
                      Escuro Padrão
                    </button>
                    <button type="button" onClick={() => setThemeColor('light')} className={`p-4 border rounded-xl flex items-center justify-center font-bold text-sm transition-all ${themeColor === 'light' ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary' : 'border-border text-zinc-400 hover:border-zinc-500'}`}>
                      <div className="w-4 h-4 rounded-full bg-[#f8fafc] border border-zinc-300 mr-2" />
                      Branco Gelo
                    </button>
                    <button type="button" onClick={() => setThemeColor('purple')} className={`p-4 border rounded-xl flex items-center justify-center font-bold text-sm transition-all ${themeColor === 'purple' ? 'border-primary ring-2 ring-primary/20 bg-primary/5 text-primary' : 'border-border text-zinc-400 hover:border-zinc-500'}`}>
                      <div className="w-4 h-4 rounded-full bg-purple-950 border border-purple-500/50 mr-2" />
                      Roxo Neon
                    </button>
                  </div>
                </div>
                  </>
                )}
              </CardContent>
            </Card>

          </div>

            {/* Seção do Agente Autônomo de Telegram */}
          <div className="mt-8">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" /> Agente Autônomo do Telegram IA
                </CardTitle>
                <CardDescription>Configure as diretrizes e módulos que a Inteligência Artificial controlará no seu Bot do Telegram.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan === 'bronze' || plan === 'prata' ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-muted/50 rounded-lg border border-dashed border-border">
                    <div className="p-4 bg-purple-500/10 rounded-full text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <Bot className="w-12 h-12" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-foreground text-base">Agente Autônomo com IA Bloqueado</h3>
                      <p className="text-muted-foreground text-xs mt-1 max-w-md">O Agente de Telegram Autônomo responde seus clientes, envia comprovantes e faz cobranças de forma 100% automatizada. Faça o upgrade para o Plano Ouro para ativar.</p>
                    </div>
                    <Button type="button" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/25 border-0" onClick={() => navigate('/planos')}>Fazer Upgrade para Ouro</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Formulário do Agente */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-background">
                      <input 
                        type="checkbox" 
                        id="agentEnabled" 
                        className="w-5 h-5 accent-primary cursor-pointer"
                        checked={agentEnabled}
                        onChange={(e) => setAgentEnabled(e.target.checked)}
                      />
                      <label htmlFor="agentEnabled" className="flex-1 cursor-pointer text-sm font-semibold flex items-center gap-2">
                        Ativar Agente Autônomo no Telegram
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-primary" /> Bot Token (obtido no @BotFather)</label>
                      <Input 
                        value={botToken} 
                        onChange={e => setBotToken(e.target.value)} 
                        placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Crie um bot falando com o @BotFather no Telegram, copie o token e cole aqui.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Direcionamento do Agente (Prompt de Instruções)</label>
                      <textarea 
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={agentPrompt} 
                        onChange={e => setAgentPrompt(e.target.value)} 
                        placeholder="Ex: Você é um vendedor focado em moda masculina. Ofereça descontos e tire dúvidas sobre os tamanhos P, M e G." 
                      />
                    </div>

                    <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-background">
                      <input 
                        type="checkbox" 
                        id="handoffEnabled" 
                        className="w-5 h-5 accent-primary cursor-pointer"
                        checked={handoffEnabled}
                        onChange={(e) => setHandoffEnabled(e.target.checked)}
                      />
                      <label htmlFor="handoffEnabled" className="flex-1 cursor-pointer text-sm font-medium">
                        Redirecionar para atendente humano caso o cliente solicite
                      </label>
                    </div>
                  </div>

                  {/* Configurações de Módulos e Status da Conexão */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-white uppercase tracking-wider text-xs">Módulos de Atuação do Agente</label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2.5 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors">
                          <input 
                            type="checkbox" 
                            id="feat-sell" 
                            className="w-4 h-4 accent-primary cursor-pointer"
                            checked={features.includes('sell_products')}
                            onChange={() => toggleFeature('sell_products')}
                          />
                          <label htmlFor="feat-sell" className="flex-1 cursor-pointer text-sm">
                            **Vender Produtos:** Consultar preços e sugerir itens do estoque.
                          </label>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors">
                          <input 
                            type="checkbox" 
                            id="feat-receipt" 
                            className="w-4 h-4 accent-primary cursor-pointer"
                            checked={features.includes('send_receipts')}
                            onChange={() => toggleFeature('send_receipts')}
                          />
                          <label htmlFor="feat-receipt" className="flex-1 cursor-pointer text-sm">
                            **Enviar Comprovantes:** Informar detalhes das compras do caixa.
                          </label>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors">
                          <input 
                            type="checkbox" 
                            id="feat-reservation" 
                            className="w-4 h-4 accent-primary cursor-pointer"
                            checked={features.includes('receive_reservations')}
                            onChange={() => toggleFeature('receive_reservations')}
                          />
                          <label htmlFor="feat-reservation" className="flex-1 cursor-pointer text-sm">
                            **Receber Reservas da Vitrine:** Confirmar pedidos feitos online.
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Conexão com Telegram Bot */}
                    <div className="p-4 bg-background border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Conexão Telegram</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          webhookStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
                          webhookStatus === 'error' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {webhookStatus === 'connected' ? 'Conectado (Webhook Ativo)' :
                           webhookStatus === 'error' ? 'Erro no Token' : 'Pendente'}
                        </span>
                      </div>

                      <Button type="button" onClick={handleTestBot} className="w-full bg-primary hover:bg-primary/95 text-white">
                        Testar Token e Conectar
                      </Button>

                      {webhookStatus === 'connected' && botUsername && (
                        <div className="space-y-2 pt-2 border-t border-border mt-4 text-center">
                          <p className="text-sm text-zinc-400">Seu bot está online!</p>
                          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold flex items-center justify-center gap-2">
                            t.me/{botUsername}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex flex-col-reverse md:flex-row justify-end items-center gap-4 w-full">
            {success && <span className="text-green-500 font-medium w-full text-center md:w-auto md:text-left">Configurações salvas com sucesso!</span>}
            <Button type="submit" size="lg" disabled={loading} className="w-full md:w-48 text-lg font-semibold shadow-lg shadow-primary/20">
              <Save className="w-5 h-5 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
