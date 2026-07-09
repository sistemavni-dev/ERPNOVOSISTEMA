import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card"
import { Settings as SettingsIcon, ArrowLeft, Save, Building2, Store, Bot, Smartphone } from "lucide-react"

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)

  // Dados da Empresa
  const [name, setName] = useState("")
  const [document, setDocument] = useState("")
  const [address, setAddress] = useState("")

  // Vitrine Virtual
  const [storeSlug, setStoreSlug] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [storeDescription, setStoreDescription] = useState("")
  const [plan, setPlan] = useState<string | null>(null)

  // Estados do Agente de WhatsApp
  const [agentEnabled, setAgentEnabled] = useState(false)
  const [agentNumber, setAgentNumber] = useState("")
  const [agentPrompt, setAgentPrompt] = useState("Você é um atendente simpático. Tire dúvidas de clientes.")
  const [handoffEnabled, setHandoffEnabled] = useState(true)
  const [features, setFeatures] = useState<string[]>([])
  const [instanceStatus, setInstanceStatus] = useState<"disconnected" | "connected" | "connecting">("disconnected")
  const [qrCodeUrl, setQrCodeUrl] = useState("")

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
        setStoreSlug(tenant.store_slug || "")
        setWhatsapp(tenant.whatsapp_number || "")
        setStoreDescription(tenant.store_description || "")
        setPlan(tenant.plan)
      }

      // Buscar configurações do agente
      const { data: agent } = await supabase
        .from('whatsapp_agents')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (agent) {
        setAgentEnabled(agent.is_active)
        setAgentNumber(agent.whatsapp_number || "")
        setAgentPrompt(agent.agent_prompt || "Você é um atendente simpático. Tire dúvidas de clientes.")
        setHandoffEnabled(agent.handoff_enabled)
        setFeatures(agent.features || [])
        setInstanceStatus(agent.instance_status || "disconnected")
      }
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return
    
    setLoading(true)
    setSuccess(false)
    
    const { error } = await supabase
      .from('tenants')
      .update({
        name,
        document,
        address,
        store_slug: storeSlug || null, // Permite nulo se vazio
        whatsapp_number: whatsapp,
        store_description: storeDescription
      })
      .eq('id', profileId)

    // Salvar configurações do agente em conjunto
    await supabase
      .from('whatsapp_agents')
      .upsert({
        id: profileId,
        whatsapp_number: agentNumber,
        is_active: agentEnabled,
        features: features,
        agent_prompt: agentPrompt,
        handoff_enabled: handoffEnabled,
        instance_name: `instance_${profileId.slice(0, 8)}`,
        instance_status: instanceStatus
      })

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

  // Simular conexão da Evolution API
  const handleConnectWhatsApp = () => {
    if (!agentNumber) {
      alert("Por favor, preencha o número de WhatsApp do agente primeiro.")
      return
    }

    setInstanceStatus("connecting")
    // Gerar QR code falso
    setQrCodeUrl("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=EvolutionAPIMockConnectionQR")

    // Conectar após 6 segundos automaticamente
    setTimeout(async () => {
      setInstanceStatus("connected")
      setQrCodeUrl("")
      if (profileId) {
        await supabase
          .from('whatsapp_agents')
          .update({ instance_status: 'connected' })
          .eq('id', profileId)
      }
    }, 6000)
  }

  const toggleFeature = (feat: string) => {
    setFeatures(prev => 
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    )
  }

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen dark text-foreground">
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
                  {plan === 'prata' ? (
                    <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground border border-border flex items-center justify-between">
                      <span>Esta funcionalidade é exclusiva do Plano Ouro.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate('/planos')}>Fazer Upgrade</Button>
                    </div>
                  ) : (
                    <Input 
                      value={whatsapp} 
                      onChange={e => setWhatsapp(e.target.value)} 
                      placeholder="5511999999999" 
                    />
                  )}
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
              </CardContent>
            </Card>

          </div>

          {/* Seção do Agente Autônomo de WhatsApp */}
          <div className="mt-8">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" /> Agente Autônomo de WhatsApp IA
                </CardTitle>
                <CardDescription>Configure as diretrizes e módulos que a Inteligência Artificial controlará no seu WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {plan === 'prata' ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-slate-900/10 rounded-lg border border-dashed border-white/5">
                    <div className="p-4 bg-purple-500/10 rounded-full text-purple-400 border border-purple-500/20">
                      <Bot className="w-12 h-12" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Agente Autônomo com IA Bloqueado</h3>
                      <p className="text-zinc-500 text-xs mt-1 max-w-md">O Agente de WhatsApp Autônomo responde seus clientes, envia comprovantes e faz cobranças de forma 100% automatizada. Faça o upgrade para o Plano Ouro para ativar.</p>
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
                        Ativar Agente de WhatsApp Autônomo
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-primary" /> Número do WhatsApp do Agente</label>
                      <Input 
                        value={agentNumber} 
                        onChange={e => setAgentNumber(e.target.value)} 
                        placeholder="Ex: 5511999999999" 
                      />
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

                    {/* Conexão com Evolution API */}
                    <div className="p-4 bg-background border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Conexão Evolution API</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          instanceStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' :
                          instanceStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {instanceStatus === 'connected' ? 'Conectado' :
                           instanceStatus === 'connecting' ? 'Gerando QR...' : 'Desconectado'}
                        </span>
                      </div>

                      {instanceStatus === 'disconnected' && (
                        <Button type="button" onClick={handleConnectWhatsApp} className="w-full bg-primary hover:bg-primary/95 text-white">
                          Conectar WhatsApp
                        </Button>
                      )}

                      {instanceStatus === 'connecting' && qrCodeUrl && (
                        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border border-border max-w-[200px] mx-auto gap-2">
                          <img src={qrCodeUrl} alt="Conexão WhatsApp QR" className="w-36 h-36" />
                          <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-mono">Escaneie o QR Code</p>
                        </div>
                      )}

                      {instanceStatus === 'connected' && (
                        <div className="space-y-2">
                          <p className="text-xs text-zinc-400">Instância ativa e pronta para responder no número *{agentNumber}*.</p>
                          <Button type="button" variant="outline" onClick={() => setInstanceStatus('disconnected')} className="w-full border-white/5 hover:bg-rose-500/10 hover:text-rose-400">
                            Desconectar Instância
                          </Button>
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
